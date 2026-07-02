"use client"

import { db } from "@/lib/db/indexeddb"
import { registerFieldFlowBackgroundSync } from "@/lib/sync/register-background-sync"
import { useSyncStore } from "@/stores/syncStore"
import { invalidate } from "@/lib/invalidation"
import type { DemoUser } from "@/types/auth"
import type { MutationEntry, ConflictRecord } from "@/types/sync"

type ConflictChoice = "yours" | "remote" | "manual"
type ResolutionInput = Record<string, { choice: ConflictChoice | string; value: unknown }>

function mapChoice(choice: string): "accept_a" | "accept_b" | "manual" {
  if (choice === "remote") return "accept_b"
  if (choice === "manual") return "manual"
  return "accept_a"
}

function resolvedValue(conflict: ConflictRecord, choice: "accept_a" | "accept_b" | "manual", manualValue: unknown) {
  if (choice === "accept_a") return conflict.value_a
  if (choice === "accept_b") return conflict.value_b
  return manualValue
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function stableHash(value: unknown) {
  let hash = 5381
  const input = stableJson(value)
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
}

export async function resolveConflictsOffline({
  recordId,
  resolutions,
  rationale,
  resolvedBy,
  user,
}: {
  recordId: string
  resolutions: ResolutionInput
  rationale: string
  resolvedBy: "field_worker" | "supervisor"
  user?: DemoUser | null
}) {
  const record = await db.getRecord(recordId, user?.orgId)
  if (!record) throw new Error("offline_record_not_found")

  const allConflicts = await db.getConflicts(user?.orgId)
  const conflicts = allConflicts.filter((conflict) => (
    conflict.record_id === recordId
    && conflict.status === "OPEN"
    && Boolean(resolutions[conflict.field])
  ))
  if (conflicts.length === 0) throw new Error("offline_conflict_not_found")

  const now = Date.now()
  const baseFields = { ...(record.fields ?? {}) }
  const fields = { ...(record.fields ?? {}) }
  const mutationId = `conflict-resolution-${record.id}-${stableHash({
    recordId: record.id,
    conflictIds: conflicts.map((conflict) => conflict.id).sort(),
    resolutions,
    rationale,
    resolvedBy,
  })}`

  for (const conflict of conflicts) {
    const input = resolutions[conflict.field]
    const resolution = mapChoice(input.choice)
    fields[conflict.field] = resolvedValue(conflict, resolution, input.value)
    await db.resolveConflict(
      conflict.id,
      resolution,
      resolution === "manual" ? input.value : undefined,
      rationale,
      user?.orgId,
    )
  }

  const updated = {
    ...record,
    fields,
    status: record.status === "in_conflict" ? "conflict_resolved" : record.status,
    syncStatus: "pending",
    updatedAt: now,
    version: record.version + 1,
    lastMutationId: mutationId,
  }

  const mutation: MutationEntry = {
    client_id: mutationId,
    device_id: user?.deviceId || record.deviceId || `resolver-${resolvedBy}`,
    operation: "update",
    resource: "record",
    workflow_id: record.workflowId,
    record_id: record.id,
    payload: {
      fields,
      status: updated.status,
      state: updated.state,
      syncStatus: "pending",
      conflictResolution: {
        resolvedBy,
        rationale,
        resolutions,
        resolvedAt: new Date(now).toISOString(),
      },
    },
    client_timestamp: now,
    base_version: record.version,
    base_fields: baseFields,
    status: "PENDING",
    retry_count: 0,
    last_error: null,
    enqueued_at: now,
  }

  await db.putRecord(updated)
  await db.enqueueMutation(mutation)
  void registerFieldFlowBackgroundSync()
  useSyncStore.getState().setPendingCount((await db.getPendingMutations()).length)
  invalidate(["conflicts", "records", "review", "sync"])
  return { record: updated, conflicts }
}
