"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LayoutDashboard, LogOut, Settings, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/stores/authStore"
import { OrgSwitcher } from "@/components/layout/OrgSwitcher"
import { completeClientLogout } from "@/lib/auth/client-logout"
import { dashboardForRole } from "@/lib/auth/routes"
import { cn } from "@/lib/utils"

export function PublicAccountMenu() {
  const { t } = useTranslation()
  const { user, org, logout, hasHydrated } = useAuthStore()
  const [open, setOpen] = useState(false)
  const router = useRouter()

  if (!hasHydrated) {
    return <div className="h-10 w-24 rounded-md bg-graph-line/60" aria-hidden="true" />
  }

  if (!user) {
    return (
      <>
        <Link href="/auth/signin" className="hidden text-pencil transition-colors hover:text-ink-black min-[430px]:inline">
          {t("publicHeader.signin")}
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-md bg-ink-blue px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-blue/90 sm:px-4"
        >
          {t("publicHeader.start")}
        </Link>
      </>
    )
  }

  const dashboardHref = dashboardForRole(user.role)

  const handleLogout = async () => {
    setOpen(false)
    await completeClientLogout(logout, router)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-10 max-w-[11rem] items-center gap-2 rounded-md border border-graph-line bg-white px-2.5 text-sm font-medium text-ink-black shadow-sm transition-colors hover:bg-graph-paper"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-clay text-xs font-semibold text-white">
          {user.name?.charAt(0) || <User size={14} />}
        </span>
        <span className="hidden min-w-0 truncate sm:block">{user.name || user.email}</span>
      </button>

      {open && (
        <div className="fixed left-1/2 top-16 z-50 max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-lg border border-graph-line bg-white p-2 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:max-h-[calc(100dvh-5.5rem)] sm:w-80 sm:translate-x-0">
          <div className="border-b border-graph-line px-2 pb-2">
            <p className="truncate text-sm font-medium text-ink-black">{user.name || user.email}</p>
            <p className="mt-0.5 truncate text-xs text-pencil">{org?.name || t("workspace.current", "Workspace")}</p>
          </div>
          <div className="border-b border-graph-line px-2 py-3">
            <OrgSwitcher />
          </div>
          <div className="py-1">
            <MenuLink href={dashboardHref} icon={<LayoutDashboard size={16} />} onClick={() => setOpen(false)}>
              {t("nav.dashboard")}
            </MenuLink>
            <MenuLink href="/account/settings" icon={<Settings size={16} />} onClick={() => setOpen(false)}>
              {t("nav.settings")}
            </MenuLink>
            <button
              type="button"
              onClick={handleLogout}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-pencil transition-colors hover:bg-graph-paper hover:text-rebar")}
            >
              <LogOut size={16} />
              {t("auth.logout", "Log out")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuLink({ href, icon, children, onClick }: { href: string; icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
    >
      {icon}
      {children}
    </Link>
  )
}
