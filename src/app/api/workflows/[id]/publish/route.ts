import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"
import { validateWorkflowDefinition, workflowValidationResponse } from "@/lib/workflows/validate-definition"

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

  const errors = validateWorkflowDefinition(workflow)
  if (errors.length > 0) return NextResponse.json(workflowValidationResponse(errors), { status: 422 })

  const now = new Date().toISOString()
  const published = {
    ...workflow,
    status: "published" as const,
    version: workflow.version + 1,
    updatedAt: now,
    publishedAt: now,
  }
  await store.putWorkflowForOrg(published)
  await store.storeMutationForOrg({
    client_id: `workflow-definition-${published.id}-${published.version}-${Date.now()}`,
    device_id: "workflow-publisher",
    operation: "workflow_definition",
    resource: "workflow",
    workflow_id: published.id,
    record_id: null,
    payload: published,
    client_timestamp: Date.now(),
    base_version: workflow.version,
    base_fields: {},
    status: "ACKED",
    retry_count: 0,
    last_error: null,
    enqueued_at: Date.now(),
  }, user.orgId)

  return NextResponse.json(published)
}
