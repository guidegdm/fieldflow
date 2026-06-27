import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const store = getStore()
  const workflow = await store.getWorkflowForOrgAsync(id, user.orgId)
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  return NextResponse.json(workflow)
}
