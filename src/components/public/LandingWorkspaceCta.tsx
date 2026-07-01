"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/stores/authStore"
import { dashboardForRole } from "@/lib/auth/routes"

export function LandingWorkspaceCta() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const authenticated = Boolean(hasHydrated && user)

  return (
    <Link
      href={authenticated ? dashboardForRole(user?.role) : "/auth/signup"}
      className="inline-flex h-11 items-center rounded-md border border-ink-blue px-5 text-sm font-semibold text-ink-blue transition-colors hover:bg-ink-blue/5"
    >
      {authenticated ? t("publicHeader.goWorkspace", "Go to workspace") : t("workspace.create", "Create workspace")}
    </Link>
  )
}
