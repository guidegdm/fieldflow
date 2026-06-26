import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"

export async function POST(request: NextRequest) {
  const { conflict_id, resolution, manual_value, rationale } = await request.json()
  if (!conflict_id || !resolution) {
    return NextResponse.json({ error: "conflict_id and resolution required" }, { status: 400 })
  }

  const store = getStore()
  const conflict = store.conflicts.get(conflict_id)
  if (!conflict) return NextResponse.json({ error: "Conflict not found" }, { status: 404 })

  conflict.status = "RESOLVED"
  conflict.resolution = resolution
  if (manual_value !== undefined) conflict.manual_value = manual_value
  if (rationale) conflict.rationale = rationale
  conflict.resolved_at = Date.now()

  const record = store.getRecord(conflict.record_id)
  if (record) {
    if (resolution === "accept_a") {
      record.fields[conflict.field] = conflict.value_a
    } else if (resolution === "accept_b") {
      record.fields[conflict.field] = conflict.value_b
    } else if (resolution === "manual" && manual_value !== undefined) {
      record.fields[conflict.field] = manual_value
    }
    record.updatedAt = Date.now()
    record.version += 1
    record.syncStatus = "synced"
    store.putRecord(record)
  }

  return NextResponse.json({ success: true, conflict })
}
