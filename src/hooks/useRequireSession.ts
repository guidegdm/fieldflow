"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { getCurrentMode } from "@/lib/network-simulator"
import { hasAnyRoleAccess } from "@/lib/auth/roles"

function homeForRole(role: string | undefined | null) {
  if (role === "org_admin") return "/admin/dashboard"
  if (role === "supervisor") return "/supervisor/dashboard"
  return "/field-worker/home"
}

export function useRequireSession(allowedRoles: string[]) {
  const router = useRouter()
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const logout = useAuthStore((state) => state.logout)
  const setAuthFromApi = useAuthStore((state) => state.setAuthFromApi)
  const user = useAuthStore((state) => state.user)
  const orgSwitching = useAuthStore((state) => state.orgSwitching)
  const [checking, setChecking] = useState(true)
  const [authorizedRole, setAuthorizedRole] = useState<string | null>(null)
  const allowedRoleKey = allowedRoles.join("|")

  useEffect(() => {
    const roles = allowedRoleKey.split("|")
    if (!hasHydrated) return

    let cancelled = false
    setChecking(true)

    if (orgSwitching && user?.orgId) {
      setAuthorizedRole(user.role)
      setChecking(false)
      return
    }

    if (user?.orgId && hasAnyRoleAccess(user.role, roles) && (getCurrentMode() === "offline" || !navigator.onLine)) {
      setAuthorizedRole(user.role)
      setChecking(false)
      return
    }

    fetch("/api/auth/session", { credentials: "include" })
      .then(async (response) => {
        if (cancelled) return
        if (!response.ok) {
          logout()
          router.push("/")
          return
        }
        const data = await response.json()
        if (data.user && data.org) setAuthFromApi(data.user, data.org, data.orgs)
        if (!data.user || !hasAnyRoleAccess(data.user.role, roles)) {
          if (!data.user) {
            logout()
            router.push("/")
          } else {
            router.push(homeForRole(data.user.role))
          }
          return
        }
        setAuthorizedRole(data.user.role)
      })
      .catch(() => {
        if (!cancelled) {
          if (user?.orgId && hasAnyRoleAccess(user.role, roles) && (getCurrentMode() === "offline" || !navigator.onLine)) {
            setAuthorizedRole(user.role)
          } else {
            logout()
            router.push("/")
          }
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })

    return () => { cancelled = true }
  }, [allowedRoleKey, hasHydrated, logout, orgSwitching, router, setAuthFromApi, user?.orgId, user?.role])

  const authorized = !!authorizedRole && hasAnyRoleAccess(authorizedRole, allowedRoleKey.split("|"))
  return { ready: hasHydrated && !checking && (authorized || orgSwitching) }
}
