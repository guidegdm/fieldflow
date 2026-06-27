"use client"

import { useAuthStore } from "@/stores/authStore"
import { Sidebar } from "@/components/layout/Sidebar"
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

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />
      <main className="flex-1 overflow-auto p-8 bg-kivu-paper min-h-screen">
        {children}
      </main>
    </div>
  )
}
