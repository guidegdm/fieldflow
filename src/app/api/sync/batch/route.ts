import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import type { SyncBatchRequest, SyncBatchResponse, ConflictEntry } from "@/types/sync"
import type { ConflictRecord } from "@/types/sync"
import type { RecordData } from "@/types/record"
import type { WorkflowField } from "@/types/workflow"

function buildFieldStrategy(
  strategy: string, field: string, fieldType: string,
  localValue: unknown, serverValue: unknown, resolvedValue: unknown,
  clientTs: number, serverTs: number,
): string {
  switch (strategy) {
    case "last_write_wins":
      if (clientTs >= serverTs) {
        return `Auto-resolved via last_write_wins: client timestamp ${new Date(clientTs).toISOString()} ≥ server timestamp ${new Date(serverTs).toISOString()}`
      }
      return `Auto-resolved via last_write_wins: server timestamp ${new Date(serverTs).toISOString()} > client timestamp ${new Date(clientTs).toISOString()}`
    case "server_authoritative":
      return "Server authoritative field — client value discarded in favour of server value"
    case "manual":
      return `Manual review required — field "${field}" listed in manualResolutionFields`
    case "average":
      return `Auto-resolved via average: (${String(localValue)} + ${String(serverValue)}) / 2 = ${String(resolvedValue)}`
    case "max":
      return `Auto-resolved via max: max(${String(localValue)}, ${String(serverValue)}) = ${String(resolvedValue)}`
    case "min":
      return `Auto-resolved via min: min(${String(localValue)}, ${String(serverValue)}) = ${String(resolvedValue)}`
    default:
      return `Applied strategy: ${strategy}`
  }
}

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
        const opConflicts: ConflictEntry[] = []
        const mergedFields: Record<string, unknown> = {}

        if (op.base_version < existing.version) {
          const workflow = store.getWorkflow(op.workflow_id)
          const offlinePolicy = workflow?.offlinePolicy
          const wfFieldMap = new Map<string, WorkflowField>(
            (workflow?.entity?.fields ?? []).map((f: WorkflowField) => [f.key, f])
          )

          for (const [field, localValue] of Object.entries(incomingFields)) {
            const serverValue = (existing.fields as any)[field]
            const isSame = JSON.stringify(serverValue) === JSON.stringify(localValue)

            if (isSame || serverValue === undefined) {
              mergedFields[field] = localValue
              continue
            }

            const wfField = wfFieldMap.get(field)
            const fieldType = wfField?.type || "text"
            const isManualField = offlinePolicy?.manualResolutionFields?.includes(field) ?? false

            let strategy: string
            let resolvedValue: unknown
            let autoResolved: boolean

            if (isManualField) {
              strategy = "manual"
              autoResolved = false
              resolvedValue = serverValue
            } else if (fieldType === "number" && offlinePolicy?.autoResolutionNumeric) {
              strategy = offlinePolicy.autoResolutionNumeric
              const a = Number(localValue)
              const b = Number(serverValue)
              if (strategy === "average") resolvedValue = (a + b) / 2
              else if (strategy === "max") resolvedValue = Math.max(a, b)
              else resolvedValue = Math.min(a, b)
              autoResolved = true
            } else if (offlinePolicy?.conflictStrategy === "server_authoritative") {
              strategy = "server_authoritative"
              resolvedValue = serverValue
              autoResolved = true
            } else {
              strategy = "last_write_wins"
              resolvedValue = op.client_timestamp >= existing.updatedAt ? localValue : serverValue
              autoResolved = true
            }

            const field_strategy = buildFieldStrategy(
              strategy, field, fieldType, localValue, serverValue,
              resolvedValue, op.client_timestamp, existing.updatedAt,
            )

            if (autoResolved) mergedFields[field] = resolvedValue

            opConflicts.push({
              client_id: op.client_id,
              record_id: op.record_id!,
              field,
              local_value: localValue,
              server_value: serverValue,
              strategy: strategy as ConflictEntry["strategy"],
              field_strategy,
              auto_resolved: autoResolved,
              resolved_value: autoResolved ? resolvedValue : undefined,
            })

            store.pushAuditEvent({
              id: crypto.randomUUID(),
              type: autoResolved ? "conflict_auto_resolved" : "conflict_escalated",
              record_id: op.record_id!,
              field,
              strategy,
              field_strategy,
              client_value: localValue,
              server_value: serverValue,
              resolved_value: autoResolved ? resolvedValue : undefined,
              detail: field_strategy,
              timestamp: Date.now(),
            })
          }
        } else {
          Object.assign(mergedFields, incomingFields)
        }

        existing.fields = { ...existing.fields, ...mergedFields }
        existing.version += 1
        existing.updatedAt = Date.now()

        const hasEscalated = opConflicts.some((c) => !c.auto_resolved)
        existing.syncStatus = hasEscalated ? "conflict" : "synced"
        store.putRecord(existing)
        store.storeMutation({ ...op, payload: existing })

        for (const ec of opConflicts.filter((c) => !c.auto_resolved)) {
          const cr: ConflictRecord = {
            id: crypto.randomUUID(),
            workflow_id: op.workflow_id,
            record_id: op.record_id!,
            field: ec.field,
            value_a: ec.local_value,
            device_a: body.device_id,
            value_b: ec.server_value,
            device_b: existing.deviceId || "server",
            status: "OPEN",
            created_at: Date.now(),
          }
          store.putConflict(cr)
        }

        acked.push(op.client_id)
        if (opConflicts.length > 0) conflicts.push(...opConflicts)
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
