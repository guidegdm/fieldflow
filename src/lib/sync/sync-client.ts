import { db } from "@/lib/db/indexeddb"
import { apiGet, apiPost } from "@/lib/api/client"
import { generateId } from "@/lib/utils"
import type { SyncBatchRequest, SyncBatchResponse, ConflictRecord } from "@/types/sync"
import type { RecordData } from "@/types/record"

export async function pushBatch(): Promise<SyncBatchResponse> {
  const [deviceState, pending] = await Promise.all([db.getDeviceState(), db.getPendingMutations()])

  const request: SyncBatchRequest = {
    device_id: deviceState.device_id,
    device_seq: deviceState.last_seq,
    operations: pending.slice(0, 100),
  }

  return apiPost<SyncBatchResponse>("/api/sync/batch", request)
}

async function applyServerChanges(changes: SyncBatchResponse["server_changes"]) {
  for (const change of changes) {
    if (change.operation === "create" || change.operation === "update") {
      await db.putRecord(change.payload as RecordData)
    } else if (change.operation === "delete") {
      const payload = change.payload as { id?: string }
      if (payload.id) await db.deleteRecord(payload.id)
    }
  }
}

async function saveConflicts(response: SyncBatchResponse, deviceId: string, pendingMutations = new Map<string, { workflow_id: string }>()) {
  for (const c of response.conflicts) {
    if (c.auto_resolved) continue
    const mutation = pendingMutations.get(c.client_id)
    const conflictRecord: ConflictRecord = {
      id: generateId(),
      workflow_id: mutation?.workflow_id || "",
      record_id: c.record_id,
      field: c.field,
      value_a: c.local_value,
      device_a: deviceId,
      value_b: c.server_value,
      device_b: "server",
      status: "OPEN",
      created_at: Date.now(),
    }
    await db.saveConflict(conflictRecord)
    await db.updateMutationStatus(c.client_id, "CONFLICT")
  }
}

async function refreshOpenConflicts() {
  try {
    const [records, conflicts] = await Promise.all([
      db.getAllRecords(),
      apiGet<ConflictRecord[]>("/api/sync/conflict"),
    ])
    const localRecordIds = records.map((record) => record.id)
    const localConflictRecords = conflicts.filter((conflict) => localRecordIds.includes(conflict.record_id))
    await db.replaceConflictsForRecords(localRecordIds, localConflictRecords)
  } catch {
    // Keep the last local conflict snapshot when offline or unauthenticated.
  }
}

export async function fullSync(): Promise<SyncBatchResponse> {
  const [deviceState, pendingMutations] = await Promise.all([db.getDeviceState(), db.getPendingMutations()])

  if (pendingMutations.length === 0) {
    const response = await pushBatch()
    await applyServerChanges(response.server_changes)
    await saveConflicts(response, deviceState.device_id)
    await refreshOpenConflicts()
    await db.updateDeviceState({
      last_seq: response.last_seq,
      last_sync_at: response.server_timestamp,
      pending_count: 0,
    })
    return response
  }

  const response = await pushBatch()

  const mutationMap = new Map(pendingMutations.map(m => [m.client_id, m]))

  for (const clientId of response.acked) {
    await db.updateMutationStatus(clientId, "ACKED")
    await db.deleteMutation(clientId)
  }

  for (const f of response.failed) {
    await db.markMutationFailed(f.client_id, f.reason)
  }

  await applyServerChanges(response.server_changes)

  await saveConflicts(response, deviceState.device_id, mutationMap)
  await refreshOpenConflicts()

  await db.updateDeviceState({
    last_seq: response.last_seq,
    last_sync_at: response.server_timestamp,
    pending_count: 0,
  })

  return response
}
