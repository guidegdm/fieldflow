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
  projections: ProjectionEntry
}

let instance: IDBPDatabase<FieldFlowTypes> | null = null
let instancePromise: Promise<IDBPDatabase<FieldFlowTypes>> | null = null

type ProjectionEntry = {
  key: string
  value: unknown
  updatedAt: number
  orgId?: string
}

type ScopedRecordData = RecordData & { remoteId?: string }
type ScopedWorkflowDefinition = WorkflowDefinition & { remoteId?: string }
type ScopedConflictRecord = ConflictRecord & { remoteId?: string }

function scopedStorageKey(orgId: string, id: string) {
  return `${encodeURIComponent(orgId)}::${id}`
}

function originalRecordId(record: ScopedRecordData) {
  return record.remoteId || record.id
}

function originalWorkflowId(workflow: ScopedWorkflowDefinition) {
  return workflow.remoteId || workflow.id
}

function originalConflictId(conflict: ScopedConflictRecord) {
  return conflict.remoteId || conflict.id
}

function toStoredRecord(record: RecordData): RecordData {
  if (!record.orgId) return record
  const remoteId = originalRecordId(record as ScopedRecordData)
  return { ...record, id: scopedStorageKey(record.orgId, remoteId), remoteId } as RecordData
}

function fromStoredRecord(record: RecordData): RecordData {
  const scoped = record as ScopedRecordData
  if (!scoped.remoteId) return record
  const { remoteId, ...rest } = scoped
  return { ...rest, id: remoteId }
}

function toStoredWorkflow(workflow: WorkflowDefinition): WorkflowDefinition {
  if (!workflow.orgId) return workflow
  const remoteId = originalWorkflowId(workflow as ScopedWorkflowDefinition)
  return { ...workflow, id: scopedStorageKey(workflow.orgId, remoteId), remoteId } as WorkflowDefinition
}

function fromStoredWorkflow(workflow: WorkflowDefinition): WorkflowDefinition {
  const scoped = workflow as ScopedWorkflowDefinition
  if (!scoped.remoteId) return workflow
  const { remoteId, ...rest } = scoped
  return { ...rest, id: remoteId }
}

function toStoredConflict(conflict: ConflictRecord, orgId?: string): ConflictRecord {
  const scopedOrgId = conflict.orgId || orgId
  if (!scopedOrgId) return conflict
  const remoteId = originalConflictId(conflict as ScopedConflictRecord)
  return { ...conflict, orgId: scopedOrgId, id: scopedStorageKey(scopedOrgId, remoteId), remoteId } as ConflictRecord
}

function fromStoredConflict(conflict: ConflictRecord): ConflictRecord {
  const scoped = conflict as ScopedConflictRecord
  if (!scoped.remoteId) return conflict
  const { remoteId, ...rest } = scoped
  return { ...rest, id: remoteId }
}

function conflictMatches(conflict: ConflictRecord, id: string, orgId?: string) {
  const exposed = fromStoredConflict(conflict)
  return exposed.id === id && (!orgId || exposed.orgId === orgId)
}

function recordMatches(record: RecordData, id: string, orgId?: string) {
  const exposed = fromStoredRecord(record)
  return exposed.id === id && (!orgId || exposed.orgId === orgId)
}

function workflowMatches(workflow: WorkflowDefinition, id: string, orgId?: string) {
  const exposed = fromStoredWorkflow(workflow)
  return exposed.id === id && (!orgId || exposed.orgId === orgId)
}

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
  instancePromise ??= openDB<FieldFlowTypes>("fieldflow", 3, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("mutations")) db.createObjectStore("mutations", { keyPath: "client_id" })
        if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "id" })
        if (!db.objectStoreNames.contains("workflows")) db.createObjectStore("workflows", { keyPath: "id" })
        if (!db.objectStoreNames.contains("attachments")) db.createObjectStore("attachments", { keyPath: "id" })
        if (!db.objectStoreNames.contains("device_state")) db.createObjectStore("device_state", { keyPath: "key" })
        if (!db.objectStoreNames.contains("conflicts")) db.createObjectStore("conflicts", { keyPath: "id" })
        if (!db.objectStoreNames.contains("projections")) db.createObjectStore("projections", { keyPath: "key" })
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
      d.clear("projections"),
    ])
  },

  async putProjection<T>(key: string, value: T, orgId?: string) {
    const d = await getDB()
    await d.put("projections", { key, value, orgId, updatedAt: Date.now() })
  },

  async getProjection<T>(key: string): Promise<T | undefined> {
    const d = await getDB()
    const entry = await d.get("projections", key)
    return entry?.value as T | undefined
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
    await d.put("records", toStoredRecord(record))
  },

  async getRecord(id: string, orgId?: string): Promise<RecordData | undefined> {
    const d = await getDB()
    if (orgId) {
      const scoped = await d.get("records", scopedStorageKey(orgId, id))
      if (scoped) return fromStoredRecord(scoped)
    }
    const exact = await d.get("records", id)
    if (exact && (!orgId || exact.orgId === orgId)) return fromStoredRecord(exact)
    const all = await d.getAll("records")
    const found = all.find((record) => recordMatches(record, id, orgId))
    return found ? fromStoredRecord(found) : undefined
  },

  async deleteRecord(id: string, orgId?: string) {
    const d = await getDB()
    if (orgId) {
      await d.delete("records", scopedStorageKey(orgId, id))
      return
    }
    const exact = await d.get("records", id)
    if (exact) await d.delete("records", id)
    const all = await d.getAll("records")
    await Promise.all(all.filter((record) => recordMatches(record, id)).map((record) => d.delete("records", record.id)))
  },

  async getAllRecords(): Promise<RecordData[]> {
    const d = await getDB()
    return (await d.getAll("records")).map(fromStoredRecord)
  },

  async getAllRecordsForOrg(orgId: string): Promise<RecordData[]> {
    const d = await getDB()
    const all = await d.getAll("records")
    return all.map(fromStoredRecord).filter((record) => record.orgId === orgId)
  },

  async replaceRecordsForOrg(orgId: string, records: RecordData[]) {
    const d = await getDB()
    const tx = d.transaction("records", "readwrite")
    const existing = await tx.store.getAll()
    await Promise.all(existing.filter((record) => fromStoredRecord(record).orgId === orgId).map((record) => tx.store.delete(record.id)))
    await Promise.all(records.map((record) => tx.store.put(toStoredRecord({ ...record, orgId }))))
    await tx.done
  },

  async updateRecordStatus(id: string, status: RecordStatus, syncStatus?: SyncStatus, orgId?: string) {
    const d = await getDB()
    const r = orgId ? await d.get("records", scopedStorageKey(orgId, id)) : await this.getRecord(id)
    if (r) {
      const next = fromStoredRecord(r)
      next.status = status
      if (syncStatus) next.syncStatus = syncStatus
      next.updatedAt = Date.now()
      await d.put("records", toStoredRecord(next))
    }
  },

  async saveWorkflow(wf: WorkflowDefinition) {
    const d = await getDB()
    await d.put("workflows", toStoredWorkflow(wf))
  },

  async getWorkflow(id: string, orgId?: string): Promise<WorkflowDefinition | undefined> {
    const d = await getDB()
    if (orgId) {
      const scoped = await d.get("workflows", scopedStorageKey(orgId, id))
      if (scoped) return fromStoredWorkflow(scoped)
    }
    const exact = await d.get("workflows", id)
    if (exact && (!orgId || exact.orgId === orgId)) return fromStoredWorkflow(exact)
    const all = await d.getAll("workflows")
    const found = all.find((workflow) => workflowMatches(workflow, id, orgId))
    return found ? fromStoredWorkflow(found) : undefined
  },

  async getAllWorkflows(): Promise<WorkflowDefinition[]> {
    const d = await getDB()
    return (await d.getAll("workflows")).map(fromStoredWorkflow)
  },

  async getAllWorkflowsForOrg(orgId: string): Promise<WorkflowDefinition[]> {
    const d = await getDB()
    const all = await d.getAll("workflows")
    return all.map(fromStoredWorkflow).filter((workflow) => workflow.orgId === orgId)
  },

  async replaceWorkflowsForOrg(orgId: string, workflows: WorkflowDefinition[]) {
    const d = await getDB()
    const tx = d.transaction("workflows", "readwrite")
    const existing = await tx.store.getAll()
    await Promise.all(existing.filter((workflow) => fromStoredWorkflow(workflow).orgId === orgId).map((workflow) => tx.store.delete(workflow.id)))
    await Promise.all(workflows.map((workflow) => tx.store.put(toStoredWorkflow({ ...workflow, orgId }))))
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

  async saveConflict(c: ConflictRecord, orgId?: string) {
    const d = await getDB()
    await d.put("conflicts", toStoredConflict(c, orgId))
  },

  async getConflicts(orgId?: string): Promise<ConflictRecord[]> {
    const d = await getDB()
    const conflicts = (await d.getAll("conflicts")).map(fromStoredConflict)
    return orgId ? conflicts.filter((conflict) => conflict.orgId === orgId) : conflicts
  },

  async replaceConflictsForRecords(recordIds: string[], conflicts: ConflictRecord[], orgId?: string) {
    const d = await getDB()
    const ids = new Set(recordIds)
    const tx = d.transaction("conflicts", "readwrite")
    const existing = await tx.store.getAll()
    await Promise.all(existing.filter((conflict) => {
      const exposed = fromStoredConflict(conflict)
      return ids.has(exposed.record_id) && (!orgId || !exposed.orgId || exposed.orgId === orgId)
    }).map((conflict) => tx.store.delete(conflict.id)))
    await Promise.all(conflicts.map((conflict) => tx.store.put(toStoredConflict(conflict, orgId))))
    await tx.done
  },

  async resolveConflict(id: string, resolution: ConflictRecord["resolution"], manualValue?: unknown, rationale?: string, orgId?: string) {
    const d = await getDB()
    const scoped = orgId ? await d.get("conflicts", scopedStorageKey(orgId, id)) : undefined
    const c = scoped || await d.get("conflicts", id)
      || (await d.getAll("conflicts")).find((conflict) => conflictMatches(conflict, id, orgId))
    if (c) {
      const next = fromStoredConflict(c)
      next.status = "RESOLVED"
      next.resolution = resolution
      if (manualValue !== undefined) next.manual_value = manualValue
      if (rationale) next.rationale = rationale
      next.resolved_at = Date.now()
      await d.put("conflicts", toStoredConflict(next, orgId))
    }
  },
}
