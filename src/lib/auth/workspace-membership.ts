import { getStore } from "@/lib/api/in-memory-store"

type BaseUser = {
  sub: string
  email: string
  name: string
  role: string
  groups: string[]
  orgId: string
  orgs?: Array<{ id: string; name?: string }>
}

type MembershipProfile = {
  orgId?: unknown
  role?: unknown
  name?: unknown
  active?: unknown
  createdAt?: unknown
}

function profileTimestamp(profile: MembershipProfile) {
  return typeof profile.createdAt === "number" ? profile.createdAt : 0
}

export async function resolveWorkspaceMembership<T extends BaseUser>(user: T): Promise<T> {
  if (!user.email) return user

  const store = getStore()
  const profiles = (await store.listUserProfilesByEmailAsync(user.email) as MembershipProfile[])
    .filter((profile) => typeof profile.orgId === "string" && profile.orgId)
    .filter((profile) => profile.active !== false)
    .sort((a, b) => profileTimestamp(b) - profileTimestamp(a))

  if (profiles.length === 0) return user

  const current = profiles.find((profile) => profile.orgId === user.orgId) ?? profiles[0]
  const orgIds = Array.from(new Set(profiles.map((profile) => String(profile.orgId))))
  const orgs = await Promise.all(orgIds.map(async (id) => {
    const org = await store.getOrgAsync(id).catch(() => null) as { id?: string; name?: string } | null
    return { id, name: org?.name || "" }
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
  const orgs = user.orgs?.length ? user.orgs : user.orgId ? [{ id: user.orgId, name: "" }] : []
  const org = orgs.find((candidate) => candidate.id === user.orgId) ?? orgs[0] ?? { id: user.orgId, name: "" }
  return { org, orgs }
}
