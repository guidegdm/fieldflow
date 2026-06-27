import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthUser(request)
  if (!auth) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const { id } = await params
  const store = getStore()
  const workflow = store.getWorkflow(id)
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  return NextResponse.json(workflow)
}
