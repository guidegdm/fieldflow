"use client"

import { AppShell, RouteHydrationFallback } from "@/components/layout/AppShell"
import { useRequireSession } from "@/hooks/useRequireSession"
import { useAuthStore } from "@/stores/authStore"

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireSession(["supervisor"])
  const user = useAuthStore((state) => state.user)

  if (!ready) return <RouteHydrationFallback />

  return <AppShell role={user?.role === "org_admin" ? "admin" : "supervisor"}>{children}</AppShell>
}
