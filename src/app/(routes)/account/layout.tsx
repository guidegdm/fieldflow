"use client"

import { AppShell, RouteHydrationFallback } from "@/components/layout/AppShell"
import { useRequireSession } from "@/hooks/useRequireSession"
import { useAuthStore } from "@/stores/authStore"

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireSession(["field_worker"])
  const user = useAuthStore((state) => state.user)
  const role = user?.role === "org_admin" ? "admin" : user?.role === "supervisor" ? "supervisor" : "field_worker"

  if (!ready) return <RouteHydrationFallback />

  return <AppShell role={role}>{children}</AppShell>
}
