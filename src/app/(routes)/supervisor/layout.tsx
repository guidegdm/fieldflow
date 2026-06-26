"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/stores/authStore"
import { Sidebar } from "@/components/layout/Sidebar"

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const router = useRouter()
  const { t } = useTranslation()

  useEffect(() => {
    if (!user || user.role !== "supervisor") router.push("/")
  }, [user, router])

  if (!user || user.role !== "supervisor") {
    return (
      <div className="flex h-screen items-center justify-center bg-surgical-white">
        <p className="text-sm text-chart-gray">{t("common.loading")}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-surgical-white">
      <Sidebar role="supervisor" />
      <main className="flex-1 ml-64 p-6">{children}</main>
    </div>
  )
}
