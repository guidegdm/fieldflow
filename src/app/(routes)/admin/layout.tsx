"use client"

import { useAuthStore } from "@/stores/authStore"
import { Sidebar } from "@/components/layout/Sidebar"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user || user.role !== "org_admin") router.push("/")
  }, [user, router])

  if (!user || user.role !== "org_admin") return null

  return (
    <div className="flex min-h-screen">
      <Sidebar role="admin" />
      <main className="flex-1 overflow-auto p-8 bg-kivu-paper min-h-screen">
        {children}
      </main>
    </div>
  )
}
