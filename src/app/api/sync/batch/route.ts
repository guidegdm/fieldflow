import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import type { SyncBatchRequest, SyncBatchResponse } from "@/types/sync"
import type { RecordData } from "@/types/record"

export async function POST(request: NextRequest) {
  const body: SyncBatchRequest = await request.json()
  const store = getStore()

  const acked: string[] = []
  const failed: { client_id: string; reason: string }[] = []
  const conflicts: SyncBatchResponse["conflicts"] = []

  for (const op of body.operations) {
    if (store.hasMutation(op.client_id)) {
      acked.push(op.client_id)
      continue
    }

    try {
      if (op.operation === "create") {
        const payload = (op.payload as any)?.fields || op.payload
        const record: RecordData = {
          id: op.record_id || crypto.randomUUID(),
          workflowId: op.workflow_id,
          workflowVersion: 1,
          entityKey: "household",
          status: "pending_sync",
          syncStatus: "pending",
          state: "draft",
          fields: payload as Record<string, unknown>,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          createdBy: body.device_id,
          deviceId: body.device_id,
          version: 1,
        }
        store.putRecord(record)
        store.storeMutation({ ...op, payload: record })
        acked.push(op.client_id)
      } else if (op.operation === "update") {
        const existing = store.getRecord(op.record_id!)
        if (!existing) {
          failed.push({ client_id: op.client_id, reason: "RECORD_NOT_FOUND" })
          continue
        }

        const incomingFields = (op.payload as any)?.fields || op.payload as Record<string, unknown>
        const opConflicts: SyncBatchResponse["conflicts"] = []

        if (op.base_version < existing.version) {
          for (const [field, localValue] of Object.entries(incomingFields)) {
            const serverValue = (existing.fields as any)[field]
            if (JSON.stringify(serverValue) !== JSON.stringify(localValue)) {
              opConflicts.push({
                client_id: op.client_id,
                record_id: op.record_id!,
                field,
                local_value: localValue,
                server_value: serverValue,
              })
            }
          }
        }

        if (opConflicts.length > 0) {
          conflicts.push(...opConflicts)
          store.storeMutation({ ...op, payload: op.payload })
        } else {
          existing.fields = { ...existing.fields, ...incomingFields }
          existing.version += 1
          existing.updatedAt = Date.now()
          existing.syncStatus = "synced"
          store.putRecord(existing)
          store.storeMutation({ ...op, payload: existing })
        }

        acked.push(op.client_id)
      } else {
        failed.push({ client_id: op.client_id, reason: "OPERATION_NOT_SUPPORTED" })
      }
    } catch (e) {
      failed.push({ client_id: op.client_id, reason: String(e) })
    }
  }

  const serverChanges = store.getServerSince(body.device_seq)

  const deviceState = store.getDevice(body.device_id)
  if (deviceState) {
    deviceState.last_seq = store.getCurrentSeq()
    deviceState.last_sync_at = Date.now()
    deviceState.pending_count = 0
    store.putDevice(deviceState)
  }

  return NextResponse.json({
    acked,
    failed,
    conflicts,
    server_changes: serverChanges,
    last_seq: store.getCurrentSeq(),
    server_timestamp: Date.now(),
  } satisfies SyncBatchResponse)
}
