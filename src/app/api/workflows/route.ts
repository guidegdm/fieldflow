import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const store = getStore()
  const workflows = await store.getWorkflowsByOrgAsync(user.orgId)
  const records = await store.getAllRecordsForOrg(user.orgId)
  return NextResponse.json(workflows.map((workflow) => ({
    ...workflow,
    recordCount: records.filter((record) => record.workflowId === workflow.id).length,
  })))
}
