"use client"

import { AppShell } from "@/components/layout/AppShell"

export default function EngineeringLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="engineering">{children}</AppShell>
}
