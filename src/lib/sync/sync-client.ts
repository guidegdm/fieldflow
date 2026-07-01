import { db } from "@/lib/db/indexeddb"
import { apiGet, apiPost } from "@/lib/api/client"
import { generateId } from "@/lib/utils"
import type { SyncBatchRequest, SyncBatchResponse, ConflictRecord, MutationEntry } from "@/types/sync"
import type { RecordData } from "@/types/record"
import type { WorkflowDefinition } from "@/types/workflow"

function emptySyncResponse(): SyncBatchResponse {
  return {
    acked: [],
    failed: [],
    conflicts: [],
    server_changes: [],
    last_seq: 0,
    server_timestamp: Date.now(),
  }
}

function mergeSyncResponse(target: SyncBatchResponse, response: SyncBatchResponse) {
  target.acked.push(...response.acked)
  target.failed.push(...response.failed)
  target.conflicts.push(...response.conflicts)
  target.server_changes.push(...response.server_changes)
  target.last_seq = response.last_seq
  target.server_timestamp = response.server_timestamp
}

export async function pushBatch(operations?: MutationEntry[]): Promise<SyncBatchResponse> {
  const [deviceState, pending] = await Promise.all([db.getDeviceState(), operations ? Promise.resolve(operations) : db.getPendingMutations()])

  const request: SyncBatchRequest = {
    device_id: deviceState.device_id,
    device_seq: deviceState.last_seq,
    operations: pending.slice(0, 100),
  }

  return apiPost<SyncBatchResponse>("/api/sync/batch", request)
}

async function applyServerChanges(changes: SyncBatchResponse["server_changes"]) {
  for (const change of changes) {
    if (change.operation === "workflow_definition") {
      await db.saveWorkflow(change.payload as WorkflowDefinition)
    } else if (change.operation === "create" || change.operation === "update") {
      await db.putRecord(change.payload as RecordData)
    } else if (change.operation === "delete") {
      const payload = change.payload as { id?: string }
      if (payload.id) await db.deleteRecord(payload.id)
    }
  }
}

async function saveConflicts(response: SyncBatchResponse, deviceId: string, orgId?: string, pendingMutations = new Map<string, { workflow_id: string }>()) {
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
      orgId,
    }
    await db.saveConflict(conflictRecord, orgId)
    await db.updateMutationStatus(c.client_id, "CONFLICT")
  }
}

async function refreshOpenConflicts(orgId?: string) {
  try {
    const [records, conflicts] = await Promise.all([
      orgId ? db.getAllRecordsForOrg(orgId) : db.getAllRecords(),
      apiGet<ConflictRecord[]>("/api/sync/conflict"),
    ])
    const localRecordIds = records.map((record) => record.id)
    const localConflictRecords = conflicts
      .filter((conflict) => localRecordIds.includes(conflict.record_id))
      .map((conflict) => ({ ...conflict, orgId: conflict.orgId || orgId }))
    await db.replaceConflictsForRecords(localRecordIds, localConflictRecords, orgId)
  } catch {
    // Keep the last local conflict snapshot when offline or unauthenticated.
  }
}

function payloadRecordId(mutation: MutationEntry) {
  const payload = mutation.payload && typeof mutation.payload === "object" && !Array.isArray(mutation.payload)
    ? mutation.payload as { id?: unknown }
    : {}
  return mutation.record_id || (typeof payload.id === "string" ? payload.id : null)
}

async function markAcceptedRecordsSynced(response: SyncBatchResponse, mutationMap: Map<string, MutationEntry>, orgId?: string) {
  for (const clientId of response.acked) {
    const mutation = mutationMap.get(clientId)
    if (!mutation || !["create", "update", "attach_evidence"].includes(mutation.operation)) continue
    const recordId = payloadRecordId(mutation)
    if (!recordId) continue
    const record = await db.getRecord(recordId, orgId)
    if (!record) continue
    await db.putRecord({
      ...record,
      syncStatus: "synced",
      syncedAt: response.server_timestamp,
      updatedAt: Math.max(record.updatedAt || 0, response.server_timestamp),
    })
  }
}

async function markRejectedRecordsFailed(response: SyncBatchResponse, mutationMap: Map<string, MutationEntry>, orgId?: string) {
  for (const failed of response.failed) {
    const mutation = mutationMap.get(failed.client_id)
    if (!mutation || !["create", "update", "attach_evidence"].includes(mutation.operation)) continue
    const recordId = payloadRecordId(mutation)
    if (!recordId) continue
    const record = await db.getRecord(recordId, orgId)
    if (!record) continue
    await db.putRecord({ ...record, syncStatus: "failed" })
  }
}

export async function fullSync(): Promise<SyncBatchResponse> {
  const aggregate = emptySyncResponse()
  const attemptedThisRun = new Set<string>()
  let batches = 0

  while (batches < 25) {
    const [deviceState, pendingMutations] = await Promise.all([db.getDeviceState(), db.getPendingMutations()])
    const nextBatch = pendingMutations.filter((mutation) => !attemptedThisRun.has(mutation.client_id)).slice(0, 100)

    if (nextBatch.length === 0) {
      if (batches === 0) {
        const response = await pushBatch([])
        mergeSyncResponse(aggregate, response)
        await applyServerChanges(response.server_changes)
        await saveConflicts(response, deviceState.device_id, deviceState.orgId)
        await db.updateDeviceState({
          last_seq: response.last_seq,
          last_sync_at: response.server_timestamp,
          pending_count: (await db.getPendingMutations()).length,
        })
      }
      break
    }

    nextBatch.forEach((mutation) => attemptedThisRun.add(mutation.client_id))
    const mutationMap = new Map(nextBatch.map((mutation) => [mutation.client_id, mutation]))
    const response = await pushBatch(nextBatch)
    mergeSyncResponse(aggregate, response)

    for (const clientId of response.acked) {
      await db.updateMutationStatus(clientId, "ACKED")
      await db.deleteMutation(clientId)
    }

    for (const f of response.failed) {
      await db.markMutationFailed(f.client_id, f.reason)
    }

    await applyServerChanges(response.server_changes)
    await markAcceptedRecordsSynced(response, mutationMap, deviceState.orgId)
    await markRejectedRecordsFailed(response, mutationMap, deviceState.orgId)
    await saveConflicts(response, deviceState.device_id, deviceState.orgId, mutationMap)

    const remaining = await db.getPendingMutations()
    await db.updateDeviceState({
      last_seq: response.last_seq,
      last_sync_at: response.server_timestamp,
      pending_count: remaining.length,
    })

    batches += 1

    if (remaining.every((mutation) => attemptedThisRun.has(mutation.client_id))) break
  }

  await refreshOpenConflicts((await db.getDeviceState()).orgId)
  return aggregate
}
