"use client"

import { AppShell } from "@/components/layout/AppShell"
import { useAuthStore } from "@/stores/authStore"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const router = useRouter()

  useEffect(() => {
    if (hasHydrated && (!user || user.role !== "org_admin")) router.push("/")
  }, [hasHydrated, user, router])

  if (!hasHydrated || !user || user.role !== "org_admin") return null

  return <AppShell role="admin">{children}</AppShell>
}
