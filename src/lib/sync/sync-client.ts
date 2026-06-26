import { db } from "@/lib/db/indexeddb"
import { apiPost } from "@/lib/api/client"
import { generateId } from "@/lib/utils"
import type { SyncBatchRequest, SyncBatchResponse, ConflictRecord } from "@/types/sync"
import type { RecordData } from "@/types/record"

export async function pushBatch(): Promise<SyncBatchResponse> {
  const [deviceState, pending] = await Promise.all([db.getDeviceState(), db.getPendingMutations()])

  const request: SyncBatchRequest = {
    device_id: deviceState.device_id,
    device_seq: deviceState.last_seq,
    operations: pending,
  }

  return apiPost<SyncBatchResponse>("/api/sync/batch", request)
}

export async function fullSync(): Promise<void> {
  const [deviceState, pendingMutations] = await Promise.all([db.getDeviceState(), db.getPendingMutations()])

  if (pendingMutations.length === 0) {
    const response = await pushBatch()
    for (const change of response.server_changes) {
      if (change.operation === "create" || change.operation === "update") {
        await db.putRecord(change.payload as RecordData)
      }
    }
    await db.updateDeviceState({
      last_seq: response.last_seq,
      last_sync_at: response.server_timestamp,
      pending_count: 0,
    })
    return
  }

  const response = await pushBatch()

  const mutationMap = new Map(pendingMutations.map(m => [m.client_id, m]))

  for (const clientId of response.acked) {
    await db.updateMutationStatus(clientId, "ACKED")
    await db.deleteMutation(clientId)
  }

  for (const f of response.failed) {
    await db.updateMutationStatus(f.client_id, "FAILED")
  }

  for (const change of response.server_changes) {
    if (change.operation === "create" || change.operation === "update") {
      await db.putRecord(change.payload as RecordData)
    }
  }

  for (const c of response.conflicts) {
    const mutation = mutationMap.get(c.client_id)
    const conflictRecord: ConflictRecord = {
      id: generateId(),
      workflow_id: mutation?.workflow_id || "",
      record_id: c.record_id,
      field: c.field,
      value_a: c.server_value,
      device_a: "",
      value_b: c.local_value,
      device_b: deviceState.device_id,
      status: "OPEN",
      created_at: Date.now(),
    }
    await db.saveConflict(conflictRecord)
    await db.updateMutationStatus(c.client_id, "CONFLICT")
  }

  await db.updateDeviceState({
    last_seq: response.last_seq,
    last_sync_at: response.server_timestamp,
    pending_count: 0,
  })
}
