import { openDB, type IDBPDatabase } from "idb"
import type { MutationEntry, MutationStatus, DeviceState, ConflictRecord } from "@/types/sync"
import type { RecordData, RecordStatus, SyncStatus } from "@/types/record"
import type { WorkflowDefinition } from "@/types/workflow"
import type { LocalAttachment } from "@/types/attachment"

interface FieldFlowTypes {
  mutations: MutationEntry
  records: RecordData
  workflows: WorkflowDefinition
  attachments: LocalAttachment
  device_state: DeviceState
  conflicts: ConflictRecord
}

let instance: IDBPDatabase<FieldFlowTypes> | null = null
let instancePromise: Promise<IDBPDatabase<FieldFlowTypes>> | null = null

function defaultDeviceState(): DeviceState {
  return {
    key: "current",
    device_id: "",
    last_seq: 0,
    last_sync_at: null,
    pending_count: 0,
    version: 1,
    user_id: "",
    workflow_id: "",
    workflow_version: 1,
  }
}

async function getDB(): Promise<IDBPDatabase<FieldFlowTypes>> {
  if (instance) return instance
  instancePromise ??= openDB<FieldFlowTypes>("fieldflow", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("mutations")) db.createObjectStore("mutations", { keyPath: "client_id" })
        if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "id" })
        if (!db.objectStoreNames.contains("workflows")) db.createObjectStore("workflows", { keyPath: "id" })
        if (!db.objectStoreNames.contains("attachments")) db.createObjectStore("attachments", { keyPath: "id" })
        if (!db.objectStoreNames.contains("device_state")) db.createObjectStore("device_state", { keyPath: "key" })
        if (!db.objectStoreNames.contains("conflicts")) db.createObjectStore("conflicts", { keyPath: "id" })
      },
    }).then((db) => {
      instance = db
      return db
    }).catch((error) => {
      instancePromise = null
      throw error
    })
  return instancePromise
}

export const db = {
  open: getDB,

  async clearAll() {
    const d = await getDB()
    await Promise.all([
      d.clear("mutations"),
      d.clear("records"),
      d.clear("workflows"),
      d.clear("attachments"),
      d.clear("device_state"),
      d.clear("conflicts"),
    ])
  },

  async enqueueMutation(m: MutationEntry) {
    const d = await getDB()
    await d.put("mutations", m)
  },

  async getPendingMutations(): Promise<MutationEntry[]> {
    const d = await getDB()
    const all = await d.getAll("mutations")
    const now = Date.now()
    return all
      .filter(m => m.status === "PENDING" || m.status === "FAILED" || (m.status === "POISON" && (m.poison_until ?? 0) <= now))
      .sort((a, b) => a.enqueued_at - b.enqueued_at || a.client_id.localeCompare(b.client_id))
  },

  async updateMutationStatus(clientId: string, status: MutationStatus) {
    const d = await getDB()
    const m = await d.get("mutations", clientId)
    if (m) {
      m.status = status
      await d.put("mutations", m)
    }
  },

  async deleteMutation(clientId: string) {
    const d = await getDB()
    await d.delete("mutations", clientId)
  },

  async putMutation(m: MutationEntry) {
    const d = await getDB()
    await d.put("mutations", m)
  },

  async markMutationFailed(clientId: string, reason: string, maxRetries = 10, cooldownMs = 30 * 60 * 1000) {
    const d = await getDB()
    const m = await d.get("mutations", clientId)
    if (!m) return
    const retryCount = (m.retry_count ?? 0) + 1
    m.retry_count = retryCount
    m.last_error = reason
    if (retryCount >= maxRetries) {
      m.status = "POISON"
      m.poison_until = Date.now() + cooldownMs
    } else {
      m.status = "FAILED"
      m.poison_until = undefined
    }
    await d.put("mutations", m)
  },

  async putRecord(record: RecordData) {
    const d = await getDB()
    await d.put("records", record)
  },

  async getRecord(id: string): Promise<RecordData | undefined> {
    const d = await getDB()
    return d.get("records", id)
  },

  async deleteRecord(id: string) {
    const d = await getDB()
    await d.delete("records", id)
  },

  async getAllRecords(): Promise<RecordData[]> {
    const d = await getDB()
    return d.getAll("records")
  },

  async getAllRecordsForOrg(orgId: string): Promise<RecordData[]> {
    const d = await getDB()
    const all = await d.getAll("records")
    return all.filter((record) => record.orgId === orgId)
  },

  async replaceRecordsForOrg(orgId: string, records: RecordData[]) {
    const d = await getDB()
    const tx = d.transaction("records", "readwrite")
    const existing = await tx.store.getAll()
    await Promise.all(existing.filter((record) => record.orgId === orgId).map((record) => tx.store.delete(record.id)))
    await Promise.all(records.map((record) => tx.store.put(record)))
    await tx.done
  },

  async updateRecordStatus(id: string, status: RecordStatus, syncStatus?: SyncStatus) {
    const d = await getDB()
    const r = await d.get("records", id)
    if (r) {
      r.status = status
      if (syncStatus) r.syncStatus = syncStatus
      r.updatedAt = Date.now()
      await d.put("records", r)
    }
  },

  async saveWorkflow(wf: WorkflowDefinition) {
    const d = await getDB()
    await d.put("workflows", wf)
  },

  async getWorkflow(id: string): Promise<WorkflowDefinition | undefined> {
    const d = await getDB()
    return d.get("workflows", id)
  },

  async getAllWorkflows(): Promise<WorkflowDefinition[]> {
    const d = await getDB()
    return d.getAll("workflows")
  },

  async getAllWorkflowsForOrg(orgId: string): Promise<WorkflowDefinition[]> {
    const d = await getDB()
    const all = await d.getAll("workflows")
    return all.filter((workflow) => workflow.orgId === orgId)
  },

  async replaceWorkflowsForOrg(orgId: string, workflows: WorkflowDefinition[]) {
    const d = await getDB()
    const tx = d.transaction("workflows", "readwrite")
    const existing = await tx.store.getAll()
    await Promise.all(existing.filter((workflow) => workflow.orgId === orgId).map((workflow) => tx.store.delete(workflow.id)))
    await Promise.all(workflows.map((workflow) => tx.store.put(workflow)))
    await tx.done
  },

  async putAttachment(attachment: LocalAttachment) {
    const d = await getDB()
    await d.put("attachments", attachment)
  },

  async getAttachment(id: string): Promise<LocalAttachment | undefined> {
    const d = await getDB()
    return d.get("attachments", id)
  },

  async getPendingAttachments(): Promise<LocalAttachment[]> {
    const d = await getDB()
    const all = await d.getAll("attachments")
    return all.filter((attachment) => attachment.status === "local" || attachment.status === "failed")
  },

  async updateAttachment(id: string, updates: Partial<LocalAttachment>) {
    const d = await getDB()
    const existing = await d.get("attachments", id)
    if (!existing) return
    await d.put("attachments", { ...existing, ...updates, updatedAt: Date.now() })
  },

  async getDeviceState(): Promise<DeviceState> {
    const d = await getDB()
    const state = await d.get("device_state", "current")
    return state || defaultDeviceState()
  },

  async updateDeviceState(partial: Partial<DeviceState>) {
    const d = await getDB()
    const current = await d.get("device_state", "current") || defaultDeviceState()
    const updated = { ...current, ...partial, key: "current" }
    await d.put("device_state", updated)
  },

  async saveConflict(c: ConflictRecord) {
    const d = await getDB()
    await d.put("conflicts", c)
  },

  async getConflicts(): Promise<ConflictRecord[]> {
    const d = await getDB()
    return d.getAll("conflicts")
  },

  async replaceConflictsForRecords(recordIds: string[], conflicts: ConflictRecord[]) {
    const d = await getDB()
    const ids = new Set(recordIds)
    const tx = d.transaction("conflicts", "readwrite")
    const existing = await tx.store.getAll()
    await Promise.all(existing.filter((conflict) => ids.has(conflict.record_id)).map((conflict) => tx.store.delete(conflict.id)))
    await Promise.all(conflicts.map((conflict) => tx.store.put(conflict)))
    await tx.done
  },

  async resolveConflict(id: string, resolution: ConflictRecord["resolution"], manualValue?: unknown, rationale?: string) {
    const d = await getDB()
    const c = await d.get("conflicts", id)
    if (c) {
      c.status = "RESOLVED"
      c.resolution = resolution
      if (manualValue !== undefined) c.manual_value = manualValue
      if (rationale) c.rationale = rationale
      c.resolved_at = Date.now()
      await d.put("conflicts", c)
    }
  },
}
