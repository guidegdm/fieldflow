import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  if (user.role !== "org_admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const { id } = await params
  const store = getStore()
  const workflow = await store.getWorkflowForOrgAsync(id, user.orgId)
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 })

  workflow.status = "published"
  workflow.version += 1
  workflow.updatedAt = new Date().toISOString()
  workflow.publishedAt = new Date().toISOString()
  await store.putWorkflowForOrg(workflow)

  return NextResponse.json(workflow)
}
