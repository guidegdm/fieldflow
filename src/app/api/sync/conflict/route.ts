import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"

const conflictResolutionSchema = z.object({
  conflict_id: z.string().min(1),
  resolution: z.enum(["accept_a", "accept_b", "manual"]),
  manual_value: z.unknown().optional(),
  rationale: z.string().max(2000).optional(),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const store = getStore()
  return NextResponse.json(await store.getOpenConflictsForOrg(user.orgId))
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  let body: z.infer<typeof conflictResolutionSchema>
  try {
    body = conflictResolutionSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  const store = getStore()
  const conflict = await store.getConflictForOrg(body.conflict_id, user.orgId)
  if (!conflict) return NextResponse.json({ error: "Conflict not found" }, { status: 404 })

  const record = await store.getRecordForOrg(conflict.record_id, user.orgId)
  if (!record) {
    return NextResponse.json({ error: "Conflict not found" }, { status: 404 })
  }

  conflict.status = "RESOLVED"
  conflict.resolution = body.resolution
  conflict.resolved_by = user.sub
  if (body.manual_value !== undefined) conflict.manual_value = body.manual_value
  if (body.rationale) conflict.rationale = body.rationale
  conflict.resolved_at = Date.now()

  if (record) {
    if (body.resolution === "accept_a") {
      record.fields[conflict.field] = conflict.value_a
    } else if (body.resolution === "accept_b") {
      record.fields[conflict.field] = conflict.value_b
    } else if (body.resolution === "manual" && body.manual_value !== undefined) {
      record.fields[conflict.field] = body.manual_value
    }
    record.updatedAt = Date.now()
    record.version += 1
    record.syncStatus = "synced"
    await store.putRecordForOrg(record)
  }

  return NextResponse.json({ success: true, conflict })
}
