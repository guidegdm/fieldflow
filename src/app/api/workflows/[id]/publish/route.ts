import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const store = getStore()
  const workflow = store.getWorkflow(id)
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 })

  workflow.status = "published"
  workflow.version += 1
  workflow.updatedAt = new Date().toISOString()
  workflow.publishedAt = new Date().toISOString()
  store.putWorkflow(workflow)

  return NextResponse.json(workflow)
}
