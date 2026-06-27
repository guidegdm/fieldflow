"use client"

import { AppShell, RouteHydrationFallback } from "@/components/layout/AppShell"
import { useRequireSession } from "@/hooks/useRequireSession"

export default function FieldWorkerLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireSession(["field_worker"])

  if (!ready) return <RouteHydrationFallback />

  return <AppShell role="field_worker">{children}</AppShell>
}
