"use client"

import { AppShell } from "@/components/layout/AppShell"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const router = useRouter()

  useEffect(() => {
    if (hasHydrated && (!user || user.role !== "supervisor")) router.push("/")
  }, [hasHydrated, user, router])

  if (!hasHydrated || !user || user.role !== "supervisor") return null

  return <AppShell role="supervisor">{children}</AppShell>
}
