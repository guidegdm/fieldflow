import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/api/in-memory-store"
import { createSessionToken, getAuthUser, setSessionCookie } from "@/lib/auth/middleware"
import { resolveWorkspaceMembership } from "@/lib/auth/workspace-membership"
import { generateId } from "@/lib/utils"

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(160),
  sector: z.string().min(1).max(80).optional(),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user?.email) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const parsed = createWorkspaceSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })

  const now = Date.now()
  const orgId = generateId()
  const { name, sector } = parsed.data
  const store = getStore()

  try {
    await store.putOrgAsync({
      id: orgId,
      name,
      sector: sector || "other",
      createdAt: now,
      createdBy: user.email,
    })
    await store.putUserProfileAsync({
      userId: user.email,
      sub: user.sub,
      email: user.email,
      name: user.name,
      role: "org_admin",
      orgId,
      active: true,
      inviteStatus: "accepted",
      createdAt: now,
      createdBy: user.email,
    })
  } catch (error) {
    console.error("[workspaces] create failed", error)
    return NextResponse.json({ error: "Impossible de créer l'espace de travail" }, { status: 503 })
  }

  const authUser = await resolveWorkspaceMembership({
    ...user,
    role: "org_admin",
    groups: ["org_admin"],
    orgId,
  })
  const org = authUser.orgs?.find((candidate) => candidate.id === orgId) ?? { id: orgId, name, role: "org_admin" }
  const sessionToken = createSessionToken(authUser, 3600)
  const response = NextResponse.json({
    user: {
      id: authUser.sub,
      email: authUser.email,
      name: authUser.name,
      role: authUser.role,
      deviceId: "web",
      orgId: authUser.orgId,
    },
    org,
    orgs: authUser.orgs?.length ? authUser.orgs : [org],
  }, { status: 201 })
  response.headers.set("Set-Cookie", setSessionCookie(sessionToken, 3600))
  return response
}
