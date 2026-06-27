"use client"

import { AppShell, RouteHydrationFallback } from "@/components/layout/AppShell"
import { useRequireSession } from "@/hooks/useRequireSession"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireSession(["org_admin"])

  if (!ready) return <RouteHydrationFallback />

  return <AppShell role="admin">{children}</AppShell>
}
