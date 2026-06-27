import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const store = getStore()
  const records = store.getRecordsByWorkflow(id)
  return NextResponse.json(records)
}
