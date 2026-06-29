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
  await store.storeMutationForOrg({
    client_id: `workflow-definition-${workflow.id}-${workflow.version}-${Date.now()}`,
    device_id: "workflow-publisher",
    operation: "workflow_definition",
    resource: "workflow",
    workflow_id: workflow.id,
    record_id: null,
    payload: workflow,
    client_timestamp: Date.now(),
    base_version: workflow.version - 1,
    base_fields: {},
    status: "ACKED",
    retry_count: 0,
    last_error: null,
    enqueued_at: Date.now(),
  }, user.orgId)

  return NextResponse.json(workflow)
}
