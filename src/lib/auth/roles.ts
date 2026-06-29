import type { UserRole } from "@/types/auth"

const ROLE_RANK: Record<UserRole, number> = {
  field_worker: 1,
  supervisor: 2,
  org_admin: 3,
}

export function hasRoleAccess(userRole: string | undefined | null, requiredRole: string | undefined | null) {
  if (!requiredRole) return true
  if (!userRole) return false
  const userRank = ROLE_RANK[userRole as UserRole]
  const requiredRank = ROLE_RANK[requiredRole as UserRole]
  if (!userRank || !requiredRank) return userRole === requiredRole
  return userRank >= requiredRank
}

export function hasAnyRoleAccess(userRole: string | undefined | null, requiredRoles: string[]) {
  return requiredRoles.length === 0 || requiredRoles.some((requiredRole) => hasRoleAccess(userRole, requiredRole))
}

