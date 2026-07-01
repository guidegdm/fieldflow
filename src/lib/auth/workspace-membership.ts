import { getStore } from "@/lib/api/in-memory-store"

type BaseUser = {
  sub: string
  email: string
  name: string
  role: string
  groups: string[]
  orgId: string
  orgs?: Array<{ id: string; name?: string; role?: string }>
}

type MembershipProfile = {
  userId?: unknown
  email?: unknown
  orgId?: unknown
  role?: unknown
  name?: unknown
  active?: unknown
  invited?: unknown
  inviteStatus?: unknown
  inviteExpiresAt?: unknown
  createdAt?: unknown
}

function profileTimestamp(profile: MembershipProfile) {
  return typeof profile.createdAt === "number" ? profile.createdAt : 0
}

export async function resolveWorkspaceMembership<T extends BaseUser>(user: T): Promise<T> {
  if (!user.email) return user

  const store = getStore()
  const allProfiles = (await store.listUserProfilesByEmailAsync(user.email) as MembershipProfile[])
    .filter((profile) => typeof profile.orgId === "string" && profile.orgId)
    .sort((a, b) => profileTimestamp(b) - profileTimestamp(a))

  const now = Date.now()
  const pending = allProfiles.filter((profile) => (
    profile.active === false
    && profile.invited === true
    && profile.inviteStatus === "pending"
    && (typeof profile.inviteExpiresAt !== "number" || profile.inviteExpiresAt > now)
  ))

  for (const profile of pending) {
    await store.putUserProfileAsync({
      ...profile,
      userId: typeof profile.userId === "string" ? profile.userId : user.email,
      email: typeof profile.email === "string" ? profile.email : user.email,
      active: true,
      inviteStatus: "accepted",
      acceptedAt: now,
      authSubject: user.sub,
    } as Record<string, unknown>)
  }

  const profiles = (await store.listUserProfilesByEmailAsync(user.email) as MembershipProfile[])
    .filter((profile) => typeof profile.orgId === "string" && profile.orgId)
    .filter((profile) => profile.active !== false)
    .sort((a, b) => profileTimestamp(b) - profileTimestamp(a))

  if (profiles.length === 0) return user

  const current = profiles.find((profile) => profile.orgId === user.orgId) ?? profiles[0]
  const profilesByOrg = new Map<string, MembershipProfile>()
  for (const profile of profiles) {
    const orgId = String(profile.orgId)
    if (!profilesByOrg.has(orgId)) profilesByOrg.set(orgId, profile)
  }
  const orgs = await Promise.all(Array.from(profilesByOrg.entries()).map(async ([id, profile]) => {
    const org = await store.getOrgAsync(id).catch(() => null) as { id?: string; name?: string } | null
    const role = typeof profile.role === "string" ? profile.role : "field_worker"
    return { id, name: org?.name || "", role }
  }))
  const role = typeof current.role === "string" ? current.role : user.role || "field_worker"
  const name = typeof current.name === "string" ? current.name : user.name

  return {
    ...user,
    name,
    role,
    groups: [role],
    orgId: String(current.orgId),
    orgs,
  }
}

export async function responseOrgContext(user: BaseUser) {
  const orgs = user.orgs?.length ? user.orgs : user.orgId ? [{ id: user.orgId, name: "", role: user.role }] : []
  const org = orgs.find((candidate) => candidate.id === user.orgId) ?? orgs[0] ?? { id: user.orgId, name: "", role: user.role }
  const role = org.role || user.role
  return { org: { ...org, role }, orgs: orgs.map((candidate) => candidate.id === org.id ? { ...candidate, role } : candidate) }
}
