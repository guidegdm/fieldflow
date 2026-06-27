import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSessionToken, getAuthUser, setSessionCookie } from "@/lib/auth/middleware"

const switchOrgSchema = z.object({
  orgId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const parsed = switchOrgSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })

  const orgs = user.orgs?.length ? user.orgs : [{ id: user.orgId, name: "" }]
  const org = orgs.find((candidate) => candidate.id === parsed.data.orgId)
  if (!org) return NextResponse.json({ error: "Organisation interdite" }, { status: 403 })

  const switched = { ...user, orgId: org.id, orgs }
  const contextToken = createSessionToken(switched, 3600)
  const response = NextResponse.json({
    user: {
      id: switched.sub,
      email: switched.email,
      name: switched.name,
      role: switched.role,
      deviceId: "web",
      orgId: switched.orgId,
    },
    org,
    orgs,
  })
  response.headers.set("Set-Cookie", setSessionCookie(contextToken, 3600))
  return response
}
