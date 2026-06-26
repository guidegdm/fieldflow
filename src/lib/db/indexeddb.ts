import { openDB, type IDBPDatabase } from "idb"
import type { MutationEntry, MutationStatus, DeviceState, ConflictRecord } from "@/types/sync"
import type { RecordData, RecordStatus, SyncStatus } from "@/types/record"
import type { WorkflowDefinition } from "@/types/workflow"

interface FieldFlowTypes {
  mutations: MutationEntry
  records: RecordData
  workflows: WorkflowDefinition
  device_state: DeviceState
  conflicts: ConflictRecord
}

let instance: IDBPDatabase<FieldFlowTypes> | null = null

async function getDB(): Promise<IDBPDatabase<FieldFlowTypes>> {
  if (instance) return instance
  instance = await openDB<FieldFlowTypes>("fieldflow", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("mutations")) db.createObjectStore("mutations", { keyPath: "client_id" })
      if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "id" })
      if (!db.objectStoreNames.contains("workflows")) db.createObjectStore("workflows", { keyPath: "id" })
      if (!db.objectStoreNames.contains("device_state")) db.createObjectStore("device_state", { keyPath: "key" })
      if (!db.objectStoreNames.contains("conflicts")) db.createObjectStore("conflicts", { keyPath: "id" })
    },
  })
  return instance
}

export const db = {
  open: getDB,

  async enqueueMutation(m: MutationEntry) {
    const d = await getDB()
    await d.put("mutations", m)
  },

  async getPendingMutations(): Promise<MutationEntry[]> {
    const d = await getDB()
    const all = await d.getAll("mutations")
    return all.filter(m => m.status === "PENDING" || m.status === "FAILED")
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

  async putRecord(record: RecordData) {
    const d = await getDB()
    await d.put("records", record)
  },

  async getRecord(id: string): Promise<RecordData | undefined> {
    const d = await getDB()
    return d.get("records", id)
  },

  async getAllRecords(): Promise<RecordData[]> {
    const d = await getDB()
    return d.getAll("records")
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

  async getDeviceState(): Promise<DeviceState> {
    const d = await getDB()
    const state = await d.get("device_state", "current")
    return state || { key: "current", device_id: "", last_seq: 0, last_sync_at: null, pending_count: 0, version: 1, user_id: "", workflow_id: "", workflow_version: 1 }
  },

  async updateDeviceState(partial: Partial<DeviceState>) {
    const d = await getDB()
    const current = await d.get("device_state", "current") || { key: "current" } as DeviceState
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
