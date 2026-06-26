import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const store = getStore()
  const workflow = store.getWorkflow(id)
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  return NextResponse.json(workflow)
}
