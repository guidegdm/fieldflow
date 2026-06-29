"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { getCurrentMode } from "@/lib/network-simulator"
import { hasAnyRoleAccess } from "@/lib/auth/roles"

export function useRequireSession(allowedRoles: string[]) {
  const router = useRouter()
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const logout = useAuthStore((state) => state.logout)
  const setAuthFromApi = useAuthStore((state) => state.setAuthFromApi)
  const user = useAuthStore((state) => state.user)
  const [checking, setChecking] = useState(true)
  const [authorizedRole, setAuthorizedRole] = useState<string | null>(null)
  const allowedRoleKey = allowedRoles.join("|")

  useEffect(() => {
    const roles = allowedRoleKey.split("|")
    if (!hasHydrated) return

    let cancelled = false
    setChecking(true)

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
          logout()
          router.push("/")
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
  }, [allowedRoleKey, hasHydrated, logout, router, setAuthFromApi, user?.orgId, user?.role])

  const authorized = !!authorizedRole && hasAnyRoleAccess(authorizedRole, allowedRoleKey.split("|"))
  return { ready: hasHydrated && !checking && authorized }
}
