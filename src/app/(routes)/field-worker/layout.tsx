'use client'

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { ConnectivityBar } from "@/components/layout/ConnectivityBar"
import { TabBar } from "@/components/layout/TabBar"

export default function FieldWorkerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)

  useEffect(() => {
    if (hasHydrated && (!user || user.role !== "field_worker")) router.push("/")
  }, [hasHydrated, user, router])

  if (!hasHydrated || !user || user.role !== "field_worker") return null

  return (
    <div className="min-h-screen bg-graph-paper">
      <ConnectivityBar />
      <main className="pt-7 pb-16 px-4 max-w-lg mx-auto">
        {children}
      </main>
      <TabBar />
    </div>
  )
}
