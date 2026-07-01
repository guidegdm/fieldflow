import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth/middleware"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ user: null, org: null, orgs: [] })

  const orgs = user.orgs?.length ? user.orgs : [{ id: user.orgId, name: "", role: user.role }]
  const org = orgs.find((candidate) => candidate.id === user.orgId) ?? { id: user.orgId, name: "", role: user.role }
  const role = org.role || user.role
  return NextResponse.json({
    user: {
      id: user.sub,
      email: user.email,
      name: user.name,
      role,
      deviceId: "web",
      orgId: user.orgId,
    },
    org: { ...org, role },
    orgs: orgs.map((candidate) => candidate.id === org.id ? { ...candidate, role } : candidate),
  })
}
