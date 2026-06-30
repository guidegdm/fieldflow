import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"
import type { SyncBatchRequest, SyncBatchResponse, ConflictEntry } from "@/types/sync"
import type { ConflictRecord } from "@/types/sync"
import type { RecordData } from "@/types/record"
import type { WorkflowDefinition, WorkflowField } from "@/types/workflow"
import { hasAnyRoleAccess } from "@/lib/auth/roles"

const mutationSchema = z.object({
  client_id: z.string().min(1),
  device_id: z.string().min(1),
  operation: z.enum(["create", "update", "delete", "attach_evidence", "workflow_definition"]),
  resource: z.string().min(1),
  workflow_id: z.string().min(1),
  record_id: z.string().min(1).nullable(),
  payload: z.unknown(),
  client_timestamp: z.number().int().nonnegative(),
  base_version: z.number().int().nonnegative(),
  base_fields: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["PENDING", "SENDING", "ACKED", "FAILED", "CONFLICT", "POISON"]),
  retry_count: z.number().int().nonnegative(),
  last_error: z.string().nullable(),
  enqueued_at: z.number().int().nonnegative(),
})

const syncBatchSchema = z.object({
  device_id: z.string().min(1),
  device_seq: z.number().int().nonnegative(),
  operations: z.array(mutationSchema).max(100),
})

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function buildFieldStrategy(
  strategy: string, field: string, fieldType: string,
  localValue: unknown, serverValue: unknown, resolvedValue: unknown,
  operationTs: number, recordServerTs: number,
): string {
  switch (strategy) {
    case "last_write_wins":
      if (operationTs >= recordServerTs) {
        return `Auto-resolved via last_write_wins: operation timestamp ${new Date(operationTs).toISOString()} >= record timestamp ${new Date(recordServerTs).toISOString()}`
      }
      return `Auto-resolved via last_write_wins: record timestamp ${new Date(recordServerTs).toISOString()} > operation timestamp ${new Date(operationTs).toISOString()}`
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
    case "set_union":
      return `Auto-resolved via set_union for field "${field}"`
    case "append_only":
      return `Auto-resolved via append_only for field "${field}"`
    default:
      return `Applied strategy: ${strategy}`
  }
}

function uniqueValues(values: unknown[]): unknown[] {
  const seen = new Set<string>()
  const result: unknown[] = []
  for (const value of values) {
    const key = JSON.stringify(value)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
  }
  return result
}

function normalizeStateId(workflow: WorkflowDefinition, state: unknown) {
  if (typeof state !== "string" || !state) return workflow.states.find((candidate) => candidate.isInitial)?.id || workflow.states[0]?.id || "s-draft"
  return workflow.states.find((candidate) => candidate.id === state)?.id
    || workflow.states.find((candidate) => candidate.key === state)?.id
    || state
}

function isValidTransition(workflow: WorkflowDefinition, fromState: string | undefined, toState: string, role: string) {
  const normalizedFrom = normalizeStateId(workflow, fromState)
  const normalizedTo = normalizeStateId(workflow, toState)
  if (normalizedFrom === normalizedTo) return true
  return workflow.transitions.some((transition) =>
    transition.fromState === normalizedFrom &&
    transition.toState === normalizedTo &&
    hasAnyRoleAccess(role, transition.requiredRoles),
  )
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  let body: SyncBatchRequest
  try {
    body = syncBatchSchema.parse(await request.json()) as SyncBatchRequest
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  const store = getStore()

  const acked: string[] = []
  const failed: { client_id: string; reason: string }[] = []
  const conflicts: SyncBatchResponse["conflicts"] = []

  for (const op of body.operations) {
    if (await store.hasMutationForOrg(op.client_id, user.orgId)) {
      acked.push(op.client_id)
      continue
    }

    try {
      const operationServerTs = Date.now()
      if (op.operation === "workflow_definition") {
        const workflowPayload = asRecord(op.payload)
        if (workflowPayload.orgId !== user.orgId || workflowPayload.id !== op.workflow_id) {
          failed.push({ client_id: op.client_id, reason: "INVALID_WORKFLOW_DEFINITION" })
          continue
        }
        if (!(await store.claimMutationForOrg(op, user.orgId))) {
          acked.push(op.client_id)
          continue
        }
        await store.putWorkflowForOrg(op.payload as WorkflowDefinition)
        await store.completeMutationForOrg(op, user.orgId)
        acked.push(op.client_id)
        continue
      }

      const workflow = await store.getWorkflowForOrgAsync(op.workflow_id, user.orgId)
      if (!workflow) {
        failed.push({ client_id: op.client_id, reason: "WORKFLOW_NOT_FOUND" })
        continue
      }

      if (op.operation === "create") {
        const payloadObject = asRecord(op.payload)
        const payload = asRecord(payloadObject.fields ?? op.payload)
        const payloadStatus = typeof payloadObject.status === "string" ? payloadObject.status : "pending"
        const payloadState = normalizeStateId(workflow, payloadObject.state)
        const clientWorkflowVersion = typeof payloadObject.workflowVersion === "number" ? payloadObject.workflowVersion : workflow.version
        const createdAt = typeof payloadObject.createdAt === "number" ? payloadObject.createdAt : operationServerTs
        const createdBy = typeof payloadObject.createdBy === "string" ? payloadObject.createdBy : user.sub
        const deviceId = typeof payloadObject.deviceId === "string" ? payloadObject.deviceId : body.device_id
        const record: RecordData = {
          id: op.record_id || crypto.randomUUID(),
          workflowId: op.workflow_id,
          workflowVersion: clientWorkflowVersion,
          workflowVersionMismatch: clientWorkflowVersion !== workflow.version,
          entityKey: workflow.entity.key,
          status: payloadStatus as RecordData["status"],
          syncStatus: "synced",
          state: payloadState,
          fields: payload as Record<string, unknown>,
          createdAt,
          updatedAt: operationServerTs,
          createdBy,
          deviceId,
          version: 1,
          orgId: user.orgId,
        }
        if (!(await store.claimMutationForOrg(op, user.orgId))) {
          acked.push(op.client_id)
          continue
        }
        await store.putRecordForOrg(record)
        await store.completeMutationForOrg({ ...op, payload: record }, user.orgId)
        acked.push(op.client_id)
      } else if (op.operation === "update" || op.operation === "attach_evidence") {
        const existing = await store.getRecordForOrg(op.record_id!, user.orgId)
        if (!existing) {
          failed.push({ client_id: op.client_id, reason: "RECORD_NOT_FOUND" })
          continue
        }

        const payloadObject = asRecord(op.payload)
        const incomingFields = asRecord(payloadObject.fields ?? op.payload)
        const opConflicts: ConflictEntry[] = []
        const mergedFields: Record<string, unknown> = {}

        if (op.base_version < existing.version) {
          const offlinePolicy = workflow?.offlinePolicy
          const wfFieldMap = new Map<string, WorkflowField>(
            (workflow?.entity?.fields ?? []).map((f: WorkflowField) => [f.key, f])
          )

          for (const [field, localValue] of Object.entries(incomingFields)) {
            const serverValue = existing.fields[field]
            const hasBaseValue = op.base_fields && Object.prototype.hasOwnProperty.call(op.base_fields, field)
            const baseValue = hasBaseValue ? op.base_fields?.[field] : undefined
            const isSame = JSON.stringify(serverValue) === JSON.stringify(localValue)
            const serverChangedSinceBase = hasBaseValue
              ? JSON.stringify(serverValue) !== JSON.stringify(baseValue)
              : true

            if (isSame || serverValue === undefined) {
              mergedFields[field] = localValue
              continue
            }

            if (!serverChangedSinceBase) {
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
            } else if ((fieldType === "multi_select" || fieldType === "multi-select") && Array.isArray(localValue) && Array.isArray(serverValue)) {
              strategy = "set_union"
              resolvedValue = uniqueValues([...serverValue, ...localValue])
              autoResolved = true
            } else if (fieldType === "textarea" && typeof localValue === "string" && typeof serverValue === "string") {
              strategy = "append_only"
              resolvedValue = serverValue.includes(localValue) ? serverValue : `${serverValue}\n${localValue}`.trim()
              autoResolved = true
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
            } else if (offlinePolicy?.conflictStrategy === "manual") {
              strategy = "manual"
              resolvedValue = serverValue
              autoResolved = false
            } else {
              strategy = "last_write_wins"
              resolvedValue = op.client_timestamp >= existing.updatedAt ? localValue : serverValue
              autoResolved = true
            }

            const field_strategy = buildFieldStrategy(
              strategy, field, fieldType, localValue, serverValue,
              resolvedValue, strategy === "last_write_wins" ? op.client_timestamp : operationServerTs, existing.updatedAt,
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

            await store.pushAuditEventForOrg({
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
            }, user.orgId)
          }
        } else {
          Object.assign(mergedFields, incomingFields)
        }

        existing.fields = { ...existing.fields, ...mergedFields }
        if (typeof payloadObject.status === "string") existing.status = payloadObject.status
        if (typeof payloadObject.state === "string") {
          const nextState = normalizeStateId(workflow, payloadObject.state)
          if (!isValidTransition(workflow, existing.state, nextState, user.role)) {
            failed.push({ client_id: op.client_id, reason: "INVALID_STATE_TRANSITION" })
            continue
          }
          existing.state = nextState
        }
        if (!(await store.claimMutationForOrg(op, user.orgId))) {
          acked.push(op.client_id)
          continue
        }
        if (typeof payloadObject.syncStatus === "string") existing.syncStatus = payloadObject.syncStatus
        existing.version += 1
        existing.updatedAt = operationServerTs

        const hasEscalated = opConflicts.some((c) => !c.auto_resolved)
        existing.syncStatus = hasEscalated ? "conflict" : existing.syncStatus || "synced"
        await store.putRecordForOrg(existing)
        await store.completeMutationForOrg({ ...op, payload: existing }, user.orgId)

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
          await store.putConflictForOrg(cr, user.orgId)
        }

        acked.push(op.client_id)
        const escalatedConflicts = opConflicts.filter((conflict) => !conflict.auto_resolved)
        if (escalatedConflicts.length > 0) conflicts.push(...escalatedConflicts)
      } else if (op.operation === "delete") {
        const existing = await store.getRecordForOrg(op.record_id!, user.orgId)
        if (!existing) {
          failed.push({ client_id: op.client_id, reason: "RECORD_NOT_FOUND" })
          continue
        }

        if (!(await store.claimMutationForOrg(op, user.orgId))) {
          acked.push(op.client_id)
          continue
        }
        await store.deleteRecordForOrg(existing.id, user.orgId)
        await store.completeMutationForOrg({
          ...op,
          payload: { id: existing.id, orgId: user.orgId, deletedAt: operationServerTs },
        }, user.orgId)
        acked.push(op.client_id)
      } else {
        failed.push({ client_id: op.client_id, reason: "OPERATION_NOT_SUPPORTED" })
      }
    } catch (e) {
      failed.push({ client_id: op.client_id, reason: String(e) })
    }
  }

  let serverChanges = await store.getServerSinceForOrg(user.orgId, body.device_seq)
  serverChanges = serverChanges.filter((m) => {
    const payload = asRecord(m.payload)
    if (m.operation === "workflow_definition") return payload.orgId === user.orgId
    const recordId = typeof payload.id === "string" ? payload.id : null
    const rec = recordId ? (m.payload as { orgId?: string }) : null
    return rec?.orgId === user.orgId
  })

  const lastSeq = await store.getCurrentSeqForOrg(user.orgId)
  const deviceState = await store.getDeviceForOrg(body.device_id, user.orgId)
  const now = Date.now()
  await store.putDeviceForOrg({
    key: "current",
    device_id: body.device_id,
    user_id: user.sub,
    orgId: user.orgId,
    workflow_id: deviceState?.workflow_id || body.operations.find((operation) => operation.workflow_id)?.workflow_id || "",
    workflow_version: deviceState?.workflow_version || 1,
    version: deviceState?.version || 1,
    last_seq: lastSeq,
    last_sync_at: now,
    pending_count: 0,
    expiresAt: deviceState?.expiresAt,
  })

  return NextResponse.json({
    acked,
    failed,
    conflicts,
    server_changes: serverChanges,
    last_seq: lastSeq,
    server_timestamp: now,
  } satisfies SyncBatchResponse)
}
