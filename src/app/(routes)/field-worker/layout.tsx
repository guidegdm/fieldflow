"use client"

import { AppShell, RouteHydrationFallback } from "@/components/layout/AppShell"
import { useRequireSession } from "@/hooks/useRequireSession"
import { useAuthStore } from "@/stores/authStore"

export default function FieldWorkerLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireSession(["field_worker"])
  const user = useAuthStore((state) => state.user)

  if (!ready) return <RouteHydrationFallback />

  return <AppShell role={user?.role === "org_admin" ? "admin" : user?.role === "supervisor" ? "supervisor" : "field_worker"}>{children}</AppShell>
}
