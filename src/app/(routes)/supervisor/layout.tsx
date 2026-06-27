"use client"

import { AppShell, RouteHydrationFallback } from "@/components/layout/AppShell"
import { useRequireSession } from "@/hooks/useRequireSession"

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireSession(["supervisor"])

  if (!ready) return <RouteHydrationFallback />

  return <AppShell role="supervisor">{children}</AppShell>
}
