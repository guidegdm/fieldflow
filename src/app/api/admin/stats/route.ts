import { NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"

export async function GET() {
  const store = getStore()
  const counts = {
    workflows: store.getAllWorkflows().length,
    records: store.getAllRecords().length,
    devices: store.getInventoryItems().length + 1,
    conflicts: store.getOpenConflicts().length,
  }
  return NextResponse.json(counts)
}
