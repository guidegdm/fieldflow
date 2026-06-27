import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const store = getStore()
  const [workflows, records, devices, conflicts] = await Promise.all([
    store.getWorkflowsByOrgAsync(user.orgId),
    store.getAllRecordsForOrg(user.orgId),
    store.getDevicesByOrgAsync(user.orgId),
    store.getOpenConflictsForOrg(user.orgId),
  ])
  const counts = {
    workflows: workflows.length,
    records: records.length,
    devices: devices.length,
    conflicts: conflicts.length,
  }
  return NextResponse.json(counts)
}
