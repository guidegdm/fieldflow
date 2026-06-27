import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth/middleware"
import { getStore } from "@/lib/api/in-memory-store"

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || user.role !== "org_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { proposalId, workflowId, changes, orgId = "org-1" } = await req.json()
  if (!proposalId || !workflowId || !changes) {
    return NextResponse.json({ error: "proposalId, workflowId, and changes required" }, { status: 400 })
  }

  const store = getStore()
  const workflow = store.getWorkflow(workflowId)
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  }

  // Apply proposal changes to workflow definition
  if (changes.name) workflow.name = changes.name
  if (changes.description) workflow.description = changes.description

  if (Array.isArray(changes.states)) {
    for (const op of changes.states) {
      if (op.type === "add") workflow.states.push(op.data)
    }
  }
  if (Array.isArray(changes.transitions)) {
    for (const op of changes.transitions) {
      if (op.type === "add") workflow.transitions.push(op.data)
    }
  }
  if (Array.isArray(changes.roles)) {
    for (const op of changes.roles) {
      if (op.type === "add") workflow.roles.push(op.data)
    }
  }
  if (Array.isArray(changes.fields)) {
    for (const op of changes.fields) {
      if (op.type === "add") workflow.entity.fields.push(op.data)
    }
  }

  workflow.updatedAt = new Date().toISOString()
  store.putWorkflow(workflow)

  return NextResponse.json({ success: true, workflow })
}
