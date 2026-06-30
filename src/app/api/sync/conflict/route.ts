import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"
import type { ConflictRecord, MutationEntry } from "@/types/sync"

const singleConflictResolutionSchema = z.object({
  conflict_id: z.string().min(1).optional(),
  resolution: z.enum(["accept_a", "accept_b", "manual"]).optional(),
  manual_value: z.unknown().optional(),
  record_id: z.string().min(1).optional(),
  resolutions: z.record(z.string(), z.object({
    choice: z.enum(["yours", "remote", "manual"]),
    value: z.unknown(),
  })).optional(),
  rationale: z.string().max(2000).optional(),
})

function mapChoice(choice: "yours" | "remote" | "manual"): "accept_a" | "accept_b" | "manual" {
  if (choice === "yours") return "accept_a"
  if (choice === "remote") return "accept_b"
  return "manual"
}

function resolvedValue(conflict: ConflictRecord, resolution: "accept_a" | "accept_b" | "manual", manualValue: unknown) {
  if (resolution === "accept_a") return conflict.value_a
  if (resolution === "accept_b") return conflict.value_b
  return manualValue
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

async function demoExpiresAtForOrg(store: { getOrgAsync: (id: string) => Promise<unknown> }, orgId: string) {
  if (!orgId.startsWith("demo-")) return undefined
  const org = asRecord(await store.getOrgAsync(orgId).catch(() => null))
  const expiresAt = Number(org.expiresAt || 0)
  if (Number.isFinite(expiresAt) && expiresAt > Math.floor(Date.now() / 1000)) return expiresAt
  return Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const store = getStore()
  return NextResponse.json(await store.getOpenConflictsForOrg(user.orgId))
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  let body: z.infer<typeof singleConflictResolutionSchema>
  try {
    body = singleConflictResolutionSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  const store = getStore()
  const demoExpiresAt = await demoExpiresAtForOrg(store, user.orgId)
  let conflicts: ConflictRecord[] = []
  if (body.conflict_id) {
    const conflict = await store.getConflictForOrg(body.conflict_id, user.orgId)
    if (conflict) conflicts = [conflict]
  } else if (body.record_id && body.resolutions) {
    const open = await store.getOpenConflictsForOrg(user.orgId)
    conflicts = open.filter((conflict) => conflict.record_id === body.record_id && body.resolutions?.[conflict.field])
  }
  if (conflicts.length === 0) return NextResponse.json({ error: "Conflict not found" }, { status: 404 })

  const record = await store.getRecordForOrg(conflicts[0].record_id, user.orgId)
  if (!record) {
    return NextResponse.json({ error: "Conflict not found" }, { status: 404 })
  }

  const now = Date.now()
  const baseFields = { ...record.fields }
  for (const conflict of conflicts) {
    const bulk = body.resolutions?.[conflict.field]
    const resolution = bulk ? mapChoice(bulk.choice) : body.resolution
    if (!resolution) continue
    const manualValue = bulk?.value ?? body.manual_value
    record.fields[conflict.field] = resolvedValue(conflict, resolution, manualValue)

    conflict.status = "RESOLVED"
    conflict.resolution = resolution
    conflict.resolved_by = user.sub
    if (resolution === "manual") conflict.manual_value = manualValue
    if (body.rationale) conflict.rationale = body.rationale
    conflict.resolved_at = now
    if (demoExpiresAt) conflict.expiresAt = demoExpiresAt
    await store.putConflictForOrg(conflict, user.orgId)
  }

  record.updatedAt = now
  record.version += 1
  record.syncStatus = "synced"
  record.status = record.status === "in_conflict" ? "conflict_resolved" : record.status
  if (demoExpiresAt) record.expiresAt = demoExpiresAt
  await store.putRecordForOrg(record)

  const mutation: MutationEntry = {
    client_id: `conflict-resolution-${record.id}-${now}`,
    device_id: `resolver-${user.sub}`,
    operation: "update",
    resource: "record",
    workflow_id: record.workflowId,
    record_id: record.id,
    payload: record,
    client_timestamp: now,
    base_version: Math.max(0, record.version - 1),
    base_fields: baseFields,
    status: "ACKED",
    retry_count: 0,
    last_error: null,
    enqueued_at: now,
    expiresAt: demoExpiresAt,
  }
  await store.storeMutationForOrg(mutation, user.orgId)

  return NextResponse.json({ success: true, record, conflicts })
}
