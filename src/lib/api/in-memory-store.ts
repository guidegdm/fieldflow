import { createHash } from "node:crypto"
import type { RecordData } from "@/types/record"
import type { MutationEntry, DeviceState, ConflictRecord, AuditEvent, InventoryLedgerEntry } from "@/types/sync"
import type { WorkflowDefinition } from "@/types/workflow"

const DYNAMODB_ENABLED = !!(process.env.DYNAMODB_TABLE && process.env.AWS_REGION)

let _dynamoStore: typeof import("./dynamo-store").dynamoStore | null = null
async function getDynamo() {
  if (_dynamoStore) return _dynamoStore
  try {
    const mod = await import("./dynamo-store")
    _dynamoStore = mod.dynamoStore
    return _dynamoStore
  } catch { return null }
}

const g = globalThis as Record<string, unknown>

class Store {
  private records = new Map<string, RecordData>()
  private workflows = new Map<string, WorkflowDefinition>()
  private mutations = new Map<string, MutationEntry>()
  private devices = new Map<string, DeviceState>()
  private conflicts = new Map<string, ConflictRecord>()
  private criticalOps = new Map<string, { itemId: string; quantity: number; timestamp: number }>()
  private inventory = new Map<string, { id: string; name: string; total: number; reserved: number }>()
  private orgs = new Map<string, any>()
  private userProfiles = new Map<string, any>()
  private auditEvents: AuditEvent[] = []
  private inventoryLedger: InventoryLedgerEntry[] = []
  private inventoryLocks = new Set<string>()
  private ledgerSeq = 0
  private seq = 0

  getRecord(id: string) { return this.records.get(id) }
  putRecord(r: RecordData) { this.records.set(r.id, r); if (DYNAMODB_ENABLED) getDynamo().then(d => d?.putRecord(r).catch(()=>{})) }
  getAllRecords() { return Array.from(this.records.values()) }
  getRecordsByWorkflow(wfId: string) { return this.getAllRecords().filter((r) => r.workflowId === wfId) }

  putWorkflow(w: WorkflowDefinition) { this.workflows.set(w.id, w); if (DYNAMODB_ENABLED) getDynamo().then(d => d?.putWorkflow(w).catch(()=>{})) }
  getWorkflow(id: string) { return this.workflows.get(id) }
  getAllWorkflows() { return Array.from(this.workflows.values()) }

  hasMutation(clientId: string) { return this.mutations.has(clientId) }
  storeMutation(m: MutationEntry) { this.mutations.set(m.client_id, m); this.seq++ }
  getCurrentSeq() { return this.seq }
  getServerSince(seq: number): MutationEntry[] {
    return Array.from(this.mutations.values()).filter((m) => m.client_timestamp > seq)
  }

  putOrg(o: any) { this.orgs.set(o.id, o) }
  getOrg(id: string) { return this.orgs.get(id) }
  putUserProfile(p: any) { this.userProfiles.set(p.userId || p.email, p) }
  getUserProfile(userId: string) { return this.userProfiles.get(userId) }

  putDevice(d: DeviceState) { this.devices.set(d.device_id, d) }
  getDevice(deviceId: string) { return this.devices.get(deviceId) }

  putConflict(c: ConflictRecord) { this.conflicts.set(c.id, c) }
  getConflictsByRecord(rid: string) { return Array.from(this.conflicts.values()).filter((c) => c.record_id === rid) }
  getOpenConflicts() { return Array.from(this.conflicts.values()).filter((c) => c.status === "OPEN") }

  pushAuditEvent(e: AuditEvent) { this.auditEvents.push(e) }
  getAuditEvents() { return this.auditEvents }

  getInventoryLedger() { return this.inventoryLedger }

  async reserveInventory(
    itemId: string, idempotencyKey: string, qty = 1, userId?: string
  ): Promise<{ success: boolean; error?: string; remaining?: number; contentHash?: string; competingRequestId?: string; currentStock?: number; retryRecommended?: boolean }> {
    const contentHash = createHash("sha256").update(`${itemId}|${qty}|${userId || "anonymous"}`).digest("hex")

    if (this.criticalOps.has(idempotencyKey)) {
      const cached = this.criticalOps.get(idempotencyKey)!
      const item = this.inventory.get(cached.itemId)
      return { success: true, contentHash, remaining: item ? item.total - item.reserved : 0 }
    }

    const logEntry = (status: "committed" | "failed_serialization", extra: Record<string, string | undefined> = {}) => {
      const before = item ? { total: item.total, reserved: item.reserved - (status === "committed" ? qty : 0) } : { total: 0, reserved: 0 }
      const after = item ? { total: item.total, reserved: item.reserved } : { total: 0, reserved: 0 }
      this.inventoryLedger.push({
        id: `ledger-${++this.ledgerSeq}`,
        contentHash,
        itemId, quantity: qty, userId,
        stockBefore: before, stockAfter: after,
        status,
        competingRequestId: extra.competingRequestId,
        idempotencyKey,
        timestamp: Date.now(),
      })
    }

    const item = this.inventory.get(itemId)
    if (!item) {
      logEntry("failed_serialization")
      return { success: false, error: "ITEM_NOT_FOUND", contentHash, retryRecommended: false }
    }

    while (this.inventoryLocks.has(itemId)) {
      await new Promise((r) => setTimeout(r, 1))
    }
    this.inventoryLocks.add(itemId)

    try {
      const available = item.total - item.reserved
      if (available < qty) {
        const detail = {
          success: false as const, error: "SERIALIZATION_FAILURE", contentHash,
          currentStock: available,
          competingRequestId: `concurrent-${itemId}-${Date.now()}`,
          retryRecommended: true,
        }
        logEntry("failed_serialization", { competingRequestId: detail.competingRequestId })
        return detail
      }
      item.reserved += qty
      this.criticalOps.set(idempotencyKey, { itemId, quantity: qty, timestamp: Date.now() })
      logEntry("committed")
      this.pushAuditEvent({
        id: contentHash, type: "inventory_reservation", item_id: itemId, quantity: qty,
        content_hash: contentHash, status: "committed",
        detail: `Reserved ${qty} of ${item.name} (${item.total - item.reserved} remaining)`,
        timestamp: Date.now(),
      })
      return { success: true, contentHash, remaining: item.total - item.reserved }
    } finally {
      this.inventoryLocks.delete(itemId)
    }
  }

  seed() {
    this.inventory.set("inv-nfi-kit", { id: "inv-nfi-kit", name: "NFI Kit A", total: 3, reserved: 0 })
    this.inventory.set("inv-food-parcel", { id: "inv-food-parcel", name: "Food Parcel 7-day", total: 8, reserved: 0 })

    const wf: WorkflowDefinition = {
      id: "wf-1", version: 2,
      name: "Enregistrement et Distribution Humanitaire",
      nameEn: "Humanitarian Registration & Distribution",
      description: "Enregistrement des menages, evaluation des besoins et distribution d'aide",
      descriptionEn: "Household registration, needs assessment, and aid distribution",
      entity: {
        id: "entity-household", key: "household", label: "Menage", labelEn: "Household",
        fields: [
          { id: "f-1", key: "household_name", label: "Nom du menage", labelEn: "Household name", type: "text", required: true, order: 1, section: "Identification" },
          { id: "f-2", key: "head_of_household", label: "Chef de menage", labelEn: "Head of household", type: "text", required: true, order: 2, section: "Identification" },
          { id: "f-3", key: "household_size", label: "Taille du menage", labelEn: "Household size", type: "number", required: true, validation: { min: 1, max: 20 }, order: 3, section: "Identification" },
          { id: "f-4", key: "shelter_type", label: "Type d'abri", labelEn: "Shelter type", type: "select", required: true, options: [{ label: "Tente", value: "tent" }, { label: "Abri provisoire", value: "temporary" }, { label: "Hebergement", value: "hosted" }], order: 4, section: "Identification" },
          { id: "f-5", key: "village", label: "Village", labelEn: "Village", type: "text", required: true, order: 5, section: "Identification" },
          { id: "f-6", key: "gps", label: "Coordonnees GPS", labelEn: "GPS Coordinates", type: "gps", required: false, order: 6, section: "Conditions de vie" },
          { id: "f-7", key: "vulnerability_score", label: "Score de vulnerabilite", labelEn: "Vulnerability score", type: "number", required: true, validation: { min: 1, max: 5 }, order: 7, section: "Conditions de vie" },
          { id: "f-8", key: "needs", label: "Besoins prioritaires", labelEn: "Priority needs", type: "multi_select", required: true, options: [{ label: "Nourriture", value: "food" }, { label: "Eau potable", value: "water" }, { label: "Materiel d'abri", value: "shelter" }, { label: "Medicaments", value: "medicine" }], order: 8, section: "Besoins" },
        ],
      },
      states: [
        { id: "s-draft", key: "draft", label: "Brouillon", labelEn: "Draft", color: "#6B7280", isInitial: true, isTerminal: false, x: 200, y: 50 },
        { id: "s-submitted", key: "submitted", label: "Soumis", labelEn: "Submitted", color: "#2563EB", isInitial: false, isTerminal: false, x: 200, y: 150 },
        { id: "s-verified", key: "verified", label: "Verifie", labelEn: "Verified", color: "#9333EA", isInitial: false, isTerminal: false, x: 200, y: 250 },
        { id: "s-approved", key: "approved", label: "Approuve", labelEn: "Approved", color: "#16A34A", isInitial: false, isTerminal: false, x: 200, y: 350 },
        { id: "s-reserved", key: "reserved", label: "Reserve", labelEn: "Reserved", color: "#D97706", isInitial: false, isTerminal: false, x: 200, y: 450 },
        { id: "s-distributed", key: "distributed", label: "Distribue", labelEn: "Distributed", color: "#059669", isInitial: false, isTerminal: false, x: 200, y: 550 },
        { id: "s-confirmed", key: "confirmed", label: "Confirme", labelEn: "Confirmed", color: "#1D4ED8", isInitial: false, isTerminal: true, x: 200, y: 650 },
      ],
      transitions: [
        { id: "t-1", key: "submit", label: "Soumettre", labelEn: "Submit", fromState: "s-draft", toState: "s-submitted", requiredRoles: ["field_worker"] },
        { id: "t-2", key: "verify", label: "Verifier", labelEn: "Verify", fromState: "s-submitted", toState: "s-verified", requiredRoles: ["supervisor"] },
        { id: "t-3", key: "approve", label: "Approuver", labelEn: "Approve", fromState: "s-verified", toState: "s-approved", requiredRoles: ["supervisor"] },
        { id: "t-4", key: "reserve", label: "Reserver", labelEn: "Reserve", fromState: "s-approved", toState: "s-reserved", requiredRoles: ["supervisor"], sideEffects: ["inventory_reserve"] },
        { id: "t-5", key: "distribute", label: "Distribuer", labelEn: "Distribute", fromState: "s-reserved", toState: "s-distributed", requiredRoles: ["field_worker"] },
        { id: "t-6", key: "confirm", label: "Confirmer", labelEn: "Confirm", fromState: "s-distributed", toState: "s-confirmed", requiredRoles: ["field_worker"] },
      ],
      roles: [
        { id: "r-1", key: "field_worker", label: "Agent terrain", permissions: ["record:create", "record:read_own", "record:update_own", "sync:push", "sync:pull"] },
        { id: "r-2", key: "supervisor", label: "Superviseur", permissions: ["record:create", "record:read_team", "record:verify", "record:approve", "sync:push", "sync:pull", "audit:view"] },
        { id: "r-3", key: "org_admin", label: "Administrateur", permissions: ["record:create", "record:read_team", "record:verify", "record:approve", "sync:push", "sync:pull", "audit:view", "workflow:publish", "admin:manage_users"] },
      ],
      offlinePolicy: {
        maxOfflineHours: 72,
        allowedOperations: { create: true, update: true, delete: false, evidence: true },
        conflictStrategy: "manual",
        manualResolutionFields: ["household_size", "gps", "vulnerability_score"],
        autoResolutionNumeric: "average",
        maxAttachmentSizeMb: 5,
        allowedAttachmentTypes: ["image/jpeg", "image/png"],
        attachmentSyncPriority: "normal",
      },
      status: "published", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: new Date().toISOString(), author: "celine",
    }
    this.putWorkflow(wf)

    const r1: RecordData = {
      id: "rec-muhindo", workflowId: "wf-1", workflowVersion: 2, entityKey: "household",
      status: "approved", syncStatus: "synced", state: "s-approved",
      fields: { household_name: "Famille Muhindo", head_of_household: "Amina Muhindo", household_size: 5, shelter_type: "tent", village: "Kitatumba", gps: "0.518, 29.474", vulnerability_score: 3, needs: ["food", "water"] },
      createdAt: Date.now() - 86400000, updatedAt: Date.now() - 3600000, createdBy: "jean-pierre", deviceId: "device-a", version: 1, syncedAt: Date.now() - 3600000,
    }
    const r2: RecordData = {
      id: "rec-hassan", workflowId: "wf-1", workflowVersion: 2, entityKey: "household",
      status: "approved", syncStatus: "synced", state: "s-approved",
      fields: { household_name: "Famille Hassan", head_of_household: "Omar Hassan", household_size: 6, shelter_type: "temporary", village: "Bulengo", gps: "-0.125, 29.310", vulnerability_score: 4, needs: ["food", "shelter", "medicine"] },
      createdAt: Date.now() - 172800000, updatedAt: Date.now() - 7200000, createdBy: "fatima", deviceId: "device-b", version: 1, syncedAt: Date.now() - 7200000,
    }
    this.putRecord(r1)
    this.putRecord(r2)

    this.putDevice({ key: "current", device_id: "device-a", last_seq: 100, last_sync_at: Date.now() - 7200000, pending_count: 0, version: 2, user_id: "user-1", workflow_id: "wf-1", workflow_version: 2 })
    this.putDevice({ key: "current", device_id: "device-b", last_seq: 100, last_sync_at: Date.now() - 7200000, pending_count: 0, version: 2, user_id: "user-2", workflow_id: "wf-1", workflow_version: 2 })
    this.putDevice({ key: "current", device_id: "device-c", last_seq: 100, last_sync_at: Date.now() - 3600000, pending_count: 0, version: 2, user_id: "user-3", workflow_id: "wf-1", workflow_version: 2 })
    this.putDevice({ key: "current", device_id: "device-admin", last_seq: 100, last_sync_at: Date.now() - 1800000, pending_count: 0, version: 2, user_id: "user-4", workflow_id: "wf-1", workflow_version: 2 })
  }
}

const storeKey = Symbol.for("fieldflow-store")
let _store: Store = (g as Record<symbol, Store>)[storeKey]
if (!_store) {
  _store = new Store()
  _store.seed()
  ;(g as Record<symbol, Store>)[storeKey] = _store
}

export function getStore(): Store { return _store }
