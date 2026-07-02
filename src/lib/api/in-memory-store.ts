import { createHash } from "node:crypto"
import type { RecordData } from "@/types/record"
import type { MutationEntry, DeviceState, ConflictRecord, AuditEvent, InventoryLedgerEntry } from "@/types/sync"
import type { WorkflowDefinition } from "@/types/workflow"
import type { InventoryItem } from "./dynamo-store"

const DYNAMODB_ENABLED = process.env.DYNAMODB_ENABLED !== "false"

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
const scopedKey = (orgId: string | undefined, id: string) => orgId ? `${orgId}#${id}` : id

type OrgItem = Record<string, unknown> & { id: string }
type UserProfileItem = Record<string, unknown> & {
  orgId?: string
  userId?: string
  id?: string
  email?: string
  name?: string
  role?: string
  active?: boolean
  invited?: boolean
  inviteToken?: string
  inviteStatus?: string
  inviteExpiresAt?: number
  invitedBy?: string
  delivery?: string
  deliveryWarning?: string
  createdAt?: number
  updatedAt?: number
}

class Store {
  private records = new Map<string, RecordData>()
  private workflows = new Map<string, WorkflowDefinition>()
  private mutations = new Map<string, MutationEntry>()
  private devices = new Map<string, DeviceState>()
  private conflicts = new Map<string, ConflictRecord>()
  private criticalOps = new Map<string, { itemId: string; quantity: number; timestamp: number; contentHash: string }>()
  private inventory = new Map<string, InventoryItem>()
  private orgs = new Map<string, OrgItem>()
  private userProfiles = new Map<string, UserProfileItem>()
  private auditEvents: AuditEvent[] = []
  private inventoryLedger: InventoryLedgerEntry[] = []
  private demoSandboxMetrics: Array<Record<string, unknown>> = []
  private inventoryLocks = new Set<string>()
  private ledgerSeq = 0
  private seq = 0

  getRecord(id: string) { return this.records.get(id) ?? Array.from(this.records.values()).find((record) => record.id === id) }
  putRecord(r: RecordData) { this.records.set(scopedKey(r.orgId, r.id), r) }
  async getRecordForOrg(id: string, orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.getRecord(id, orgId)
    const record = this.records.get(scopedKey(orgId, id))
    return record?.orgId === orgId ? record : undefined
  }
  async putRecordForOrg(r: RecordData) {
    if (DYNAMODB_ENABLED) await (await getDynamo())?.putRecord(r)
    this.records.set(scopedKey(r.orgId, r.id), r)
  }
  async deleteRecordForOrg(id: string, orgId: string) {
    if (DYNAMODB_ENABLED) await (await getDynamo())?.deleteRecord(id, orgId)
    const key = scopedKey(orgId, id)
    const record = this.records.get(key)
    if (record?.orgId === orgId) this.records.delete(key)
  }
  getAllRecords() { return Array.from(this.records.values()) }
  async getAllRecordsForOrg(orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.listRecords(orgId) ?? []
    return this.getAllRecords().filter((r) => r.orgId === orgId)
  }
  getRecordsByWorkflow(wfId: string, orgId?: string) {
    return this.getAllRecords().filter((r) => r.workflowId === wfId && (!orgId || r.orgId === orgId))
  }
  async getRecordsByWorkflowForOrg(wfId: string, orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.getRecordsByWorkflow(wfId, orgId) ?? []
    return this.getRecordsByWorkflow(wfId, orgId)
  }

  putWorkflow(w: WorkflowDefinition) { this.workflows.set(scopedKey(w.orgId, w.id), w) }
  getWorkflow(id: string) { return this.workflows.get(id) ?? Array.from(this.workflows.values()).find((workflow) => workflow.id === id) }
  getWorkflowForOrg(id: string, orgId: string) {
    const workflow = this.workflows.get(scopedKey(orgId, id))
    if (!workflow || workflow.orgId !== orgId) return undefined
    return workflow
  }
  async getWorkflowForOrgAsync(id: string, orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.getWorkflow(id, orgId)
    return this.getWorkflowForOrg(id, orgId)
  }
  async putWorkflowForOrg(w: WorkflowDefinition) {
    if (DYNAMODB_ENABLED) await (await getDynamo())?.putWorkflow(w)
    this.workflows.set(scopedKey(w.orgId, w.id), w)
  }
  getAllWorkflows() { return Array.from(this.workflows.values()) }
  getWorkflowsByOrg(orgId: string) { return this.getAllWorkflows().filter((w) => w.orgId === orgId) }
  async getWorkflowsByOrgAsync(orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.listWorkflows(orgId) ?? []
    return this.getWorkflowsByOrg(orgId)
  }

  hasMutation(clientId: string) { return this.mutations.has(clientId) }
  storeMutation(m: MutationEntry) { this.seq++; this.mutations.set(m.client_id, { ...m, server_seq: this.seq }) }
  async hasMutationForOrg(clientId: string, orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.hasMutation(clientId, orgId) ?? false
    return this.hasMutation(clientId)
  }
  async getMutationForOrg(clientId: string, orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.getMutation(clientId, orgId)
    return this.mutations.get(clientId)
  }
  async storeMutationForOrg(m: MutationEntry, orgId: string) {
    const serverSeq = DYNAMODB_ENABLED
      ? await (await getDynamo())?.nextMutationSeq(orgId) ?? this.seq + 1
      : this.seq + 1
    this.seq = Math.max(this.seq, serverSeq)
    const stored = { ...m, server_seq: serverSeq }
    if (DYNAMODB_ENABLED) await (await getDynamo())?.putMutation(stored, orgId, serverSeq)
    this.mutations.set(m.client_id, stored)
  }
  async claimMutationForOrg(m: MutationEntry, orgId: string) {
    if (this.mutations.has(m.client_id)) return false
    const serverSeq = DYNAMODB_ENABLED
      ? await (await getDynamo())?.nextMutationSeq(orgId) ?? this.seq + 1
      : this.seq + 1
    const claimed = { ...m, status: "SENDING" as const, serverCommitStatus: "claimed", server_seq: serverSeq } as MutationEntry & { serverCommitStatus: string }
    if (DYNAMODB_ENABLED) {
      const stored = await (await getDynamo())?.putMutationIfAbsent(claimed, orgId, serverSeq)
      if (!stored) return false
    }
    this.seq = Math.max(this.seq, serverSeq)
    this.mutations.set(m.client_id, claimed)
    return true
  }
  async completeMutationForOrg(m: MutationEntry, orgId: string) {
    const existing = this.mutations.get(m.client_id)
    const serverSeq = existing?.server_seq ?? this.seq + 1
    if (!existing) this.seq = serverSeq
    const stored = { ...m, status: "ACKED" as const, serverCommitStatus: "committed", server_seq: serverSeq } as MutationEntry & { serverCommitStatus: string }
    if (DYNAMODB_ENABLED) await (await getDynamo())?.putMutation(stored, orgId, serverSeq)
    this.mutations.set(m.client_id, stored)
  }
  getCurrentSeq() { return this.seq }
  async getCurrentSeqForOrg(orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.getCurrentSeq(orgId) ?? 0
    return Math.max(0, ...Array.from(this.mutations.values()).map((m) => m.server_seq ?? 0))
  }
  getServerSince(seq: number): MutationEntry[] {
    return Array.from(this.mutations.values())
      .filter((m) => (m.server_seq ?? 0) > seq)
      .sort((a, b) => (a.server_seq ?? 0) - (b.server_seq ?? 0))
  }
  async getServerSinceForOrg(orgId: string, seq: number) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.getServerSince(orgId, seq) ?? []
    return this.getServerSince(seq).filter((m) => {
      const payload = m.payload as { id?: unknown; orgId?: unknown }
      if (payload?.orgId === orgId && m.operation === "workflow_definition") return true
      const id = typeof payload?.id === "string" ? payload.id : null
      return id ? this.records.get(scopedKey(orgId, id))?.orgId === orgId : false
    })
  }

  putOrg(o: OrgItem) { this.orgs.set(o.id, o) }
  async putOrgAsync(o: OrgItem) {
    if (DYNAMODB_ENABLED) await (await getDynamo())?.putOrgItem(o)
    this.orgs.set(o.id, o)
  }
  getOrg(id: string) { return this.orgs.get(id) }
  async getOrgAsync(id: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.getOrgItem(id)
    return this.orgs.get(id)
  }
  private userProfileKey(p: Record<string, unknown>) {
    const orgId = String(p.orgId || "")
    const userId = String(p.userId || p.email || "")
    return orgId && userId ? `${orgId}#${userId}` : userId
  }
  putUserProfile(p: UserProfileItem) { this.userProfiles.set(this.userProfileKey(p), p) }
  async putUserProfileAsync(p: UserProfileItem) {
    if (DYNAMODB_ENABLED) await (await getDynamo())?.putUserProfile(p)
    this.userProfiles.set(this.userProfileKey(p), p)
  }
  async getUsersByOrg(orgId: string): Promise<UserProfileItem[]> {
    if (DYNAMODB_ENABLED) return ((await getDynamo())?.listUserProfiles(orgId) ?? []) as Promise<UserProfileItem[]>
    return Array.from(this.userProfiles.values()).filter((p) => p.orgId === orgId)
  }
  getUserProfile(userId: string) { return this.userProfiles.get(userId) }
  async getUserProfileByEmailAsync(email: string): Promise<UserProfileItem | undefined> {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.getUserProfileByEmail(email) as Promise<UserProfileItem | undefined>
    return Array.from(this.userProfiles.values()).find((p) => p.email === email)
  }
  async listUserProfilesByEmailAsync(email: string): Promise<UserProfileItem[]> {
    if (DYNAMODB_ENABLED) return ((await getDynamo())?.listUserProfilesByEmail(email) ?? []) as Promise<UserProfileItem[]>
    return Array.from(this.userProfiles.values()).filter((p) => p.email === email)
  }

  putDevice(d: DeviceState) { this.devices.set(d.device_id, d) }
  getDevice(deviceId: string) { return this.devices.get(deviceId) }
  getDevicesByOrg(orgId: string) { return Array.from(this.devices.values()).filter((d) => d.orgId === orgId) }
  async getDeviceForOrg(deviceId: string, orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.getDevice(deviceId, orgId)
    const device = this.devices.get(deviceId)
    return device?.orgId === orgId ? device : undefined
  }
  async putDeviceForOrg(d: DeviceState) {
    if (DYNAMODB_ENABLED) await (await getDynamo())?.putDevice(d)
    this.devices.set(d.device_id, d)
  }
  async getDevicesByOrgAsync(orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.listDevices(orgId) ?? []
    return this.getDevicesByOrg(orgId)
  }

  putConflict(c: ConflictRecord) { this.conflicts.set(c.id, c) }
  getConflict(id: string) { return this.conflicts.get(id) }
  async getConflictForOrg(id: string, orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.getConflict(id, orgId)
    const conflict = this.conflicts.get(id)
    return conflict && this.records.get(scopedKey(orgId, conflict.record_id))?.orgId === orgId ? conflict : undefined
  }
  async putConflictForOrg(c: ConflictRecord, orgId: string) {
    if (DYNAMODB_ENABLED) await (await getDynamo())?.putConflict(c, orgId)
    this.conflicts.set(c.id, c)
  }
  getConflictsByRecord(rid: string) { return Array.from(this.conflicts.values()).filter((c) => c.record_id === rid) }
  getOpenConflicts(orgId?: string) {
    return Array.from(this.conflicts.values()).filter((c) => {
      if (c.status !== "OPEN") return false
      if (!orgId) return true
      return this.records.get(scopedKey(orgId, c.record_id))?.orgId === orgId
    })
  }
  async getOpenConflictsForOrg(orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.listOpenConflicts(orgId) ?? []
    return this.getOpenConflicts(orgId)
  }

  pushAuditEvent(e: AuditEvent) { this.auditEvents.push(e) }
  async pushAuditEventForOrg(e: AuditEvent, orgId: string) {
    if (DYNAMODB_ENABLED) await (await getDynamo())?.putAuditEvent(orgId, e.record_id || e.item_id || e.id, e as unknown as Record<string, unknown>)
    this.auditEvents.push(e)
  }
  getAuditEvents() { return this.auditEvents }
  async putDemoSandboxMetric(metric: Record<string, unknown>) {
    if (DYNAMODB_ENABLED) await (await getDynamo())?.putDemoSandboxMetric(metric)
    this.demoSandboxMetrics.push(metric)
  }
  getDemoSandboxMetrics() { return this.demoSandboxMetrics }

  getInventoryLedger() { return this.inventoryLedger }
  async getInventoryLedgerByOrg(orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.listInventoryLedger(orgId) ?? []
    return this.inventoryLedger.filter((entry) => this.inventory.get(entry.itemId)?.orgId === orgId)
  }
  getInventoryItem(itemId: string) { return this.inventory.get(itemId) }
  async getInventoryItemsForOrg(orgId: string) {
    if (DYNAMODB_ENABLED) return (await getDynamo())?.listInventoryItems(orgId) ?? []
    return Array.from(this.inventory.values()).filter((item) => item.orgId === orgId)
  }
  async putInventoryItemForOrg(item: InventoryItem) {
    if (DYNAMODB_ENABLED) await (await getDynamo())?.putInventoryItem(item)
    this.inventory.set(item.id, item)
  }

  async reserveInventory(
    itemId: string, idempotencyKey: string, qty = 1, userId?: string, orgId?: string
  ): Promise<{ success: boolean; error?: string; remaining?: number; contentHash?: string; competingRequestId?: string; currentStock?: number; retryRecommended?: boolean }> {
    const contentHash = createHash("sha256").update(`${orgId || "global"}|${itemId}|${qty}|${userId || "anonymous"}|${idempotencyKey}`).digest("hex")

    if (this.criticalOps.has(idempotencyKey)) {
      const cached = this.criticalOps.get(idempotencyKey)!
      if (cached.contentHash !== contentHash) {
        return { success: false, error: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_COMMAND", contentHash, retryRecommended: false }
      }
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
    if (!item || (orgId && item.orgId !== orgId)) {
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
      this.criticalOps.set(idempotencyKey, { itemId, quantity: qty, timestamp: Date.now(), contentHash })
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

  async reserveInventoryForOrg(
    itemId: string, idempotencyKey: string, qty = 1, userId: string, orgId: string
  ) {
    if (!DYNAMODB_ENABLED) return this.reserveInventory(itemId, idempotencyKey, qty, userId, orgId)

    const dynamo = await getDynamo()
    const result = await dynamo?.reserveInventory(itemId, idempotencyKey, qty, userId, orgId)
    const item = await dynamo?.getInventoryItem(itemId, orgId)
    if (item) this.inventory.set(itemId, item)
    return result ?? { success: false as const, error: "DYNAMO_UNAVAILABLE", retryRecommended: true }
  }

}

const storeKey = Symbol.for("fieldflow-store")
let _store: Store = (g as Record<symbol, Store>)[storeKey]
if (!_store) {
  _store = new Store()
  ;(g as Record<symbol, Store>)[storeKey] = _store
}

export function getStore(): Store { return _store }
