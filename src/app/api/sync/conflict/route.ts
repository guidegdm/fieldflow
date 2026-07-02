import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"
import type { ConflictRecord, MutationEntry } from "@/types/sync"

const singleConflictResolutionSchema = z.object({
  resolution_id: z.string().min(1).max(240).optional(),
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

function resolutionMutationId(userId: string, body: z.infer<typeof singleConflictResolutionSchema>) {
  if (body.resolution_id) return body.resolution_id
  const hash = createHash("sha256").update(stableJson({
    userId,
    conflict_id: body.conflict_id || "",
    record_id: body.record_id || "",
    resolution: body.resolution || "",
    manual_value: body.manual_value ?? null,
    resolutions: body.resolutions || {},
    rationale: body.rationale || "",
  })).digest("hex").slice(0, 24)
  return `conflict-resolution-${body.record_id || body.conflict_id || "unknown"}-${hash}`
}

type ServerMutation = MutationEntry & { serverCommitStatus?: string }

function isCommittedMutation(mutation: ServerMutation | undefined) {
  return !!mutation && (mutation.serverCommitStatus === "committed" || mutation.status === "ACKED")
}

async function getServerMutation(store: { getMutationForOrg: (clientId: string, orgId: string) => Promise<unknown> }, clientId: string, orgId: string) {
  return await store.getMutationForOrg(clientId, orgId).catch(() => undefined) as ServerMutation | undefined
}

async function claimOrResumeMutation(
  store: {
    claimMutationForOrg: (op: MutationEntry, orgId: string) => Promise<boolean>
    getMutationForOrg: (clientId: string, orgId: string) => Promise<unknown>
  },
  op: MutationEntry,
  orgId: string,
) {
  if (await store.claimMutationForOrg(op, orgId)) return true
  const existing = await getServerMutation(store, op.client_id, orgId)
  return !isCommittedMutation(existing)
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
  const mutationId = resolutionMutationId(user.sub, body)
  const existingMutation = await getServerMutation(store, mutationId, user.orgId)
  if (isCommittedMutation(existingMutation)) {
    const committedMutation = existingMutation as ServerMutation
    const recordId = body.record_id || String(asRecord(committedMutation.payload).id || committedMutation.record_id || "")
    const record = recordId ? await store.getRecordForOrg(recordId, user.orgId) : null
    return NextResponse.json({ success: true, idempotent: true, record, conflicts: [] })
  }

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
  if ((record as typeof record & { lastMutationId?: string }).lastMutationId === mutationId) {
    await store.completeMutationForOrg({
      client_id: mutationId,
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
    }, user.orgId)
    return NextResponse.json({ success: true, idempotent: true, record, conflicts })
  }

  const claim: MutationEntry = {
    client_id: mutationId,
    device_id: `resolver-${user.sub}`,
    operation: "update",
    resource: "record",
    workflow_id: record.workflowId,
    record_id: record.id,
    payload: { pendingConflictResolution: true, record_id: record.id },
    client_timestamp: now,
    base_version: record.version,
    base_fields: baseFields,
    status: "SENDING",
    retry_count: 0,
    last_error: null,
    enqueued_at: now,
    expiresAt: demoExpiresAt,
  }
  if (!(await claimOrResumeMutation(store, claim, user.orgId))) {
    return NextResponse.json({ success: true, idempotent: true, record, conflicts: [] })
  }

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
  ;(record as typeof record & { lastMutationId?: string }).lastMutationId = mutationId
  if (demoExpiresAt) record.expiresAt = demoExpiresAt
  await store.putRecordForOrg(record)

  const mutation: MutationEntry = {
    client_id: mutationId,
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
