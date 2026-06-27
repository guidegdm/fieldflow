"use client"

import { AppShell } from "@/components/layout/AppShell"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"

export default function FieldWorkerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  useEffect(() => {
    if (hasHydrated && (!user || user.role !== "field_worker")) router.push("/")
  }, [hasHydrated, user, router])

  if (!hasHydrated || !user || user.role !== "field_worker") return null

  return <AppShell role="field_worker">{children}</AppShell>
}
