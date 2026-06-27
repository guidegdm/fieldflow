import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth/middleware"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const org = user.orgs?.find((candidate) => candidate.id === user.orgId) ?? { id: user.orgId, name: "" }
  return NextResponse.json({
    user: {
      id: user.sub,
      email: user.email,
      name: user.name,
      role: user.role,
      deviceId: "web",
      orgId: user.orgId,
    },
    org,
    orgs: user.orgs?.length ? user.orgs : [org],
  })
}
