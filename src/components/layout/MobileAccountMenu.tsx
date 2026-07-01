"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import {
  Activity,
  AlertTriangle,
  Home,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Search,
  Settings,
  Users,
  Workflow,
  X,
} from "lucide-react"
import { OrgSwitcher } from "@/components/layout/OrgSwitcher"
import { WorkflowSwitcher } from "@/components/layout/WorkflowSwitcher"
import { useAuthStore } from "@/stores/authStore"
import { clearClientSessionState } from "@/lib/auth/client-session-cleanup"
import { cn } from "@/lib/utils"

type AppRole = "admin" | "supervisor" | "field_worker" | "engineering"
type MobileNavItem = { labelKey: string; fallback: string; href: string; icon: React.ReactNode }

const mobileNavByRole: Record<AppRole, MobileNavItem[]> = {
  field_worker: [
    { labelKey: "nav.home", fallback: "Home", href: "/field-worker/home", icon: <Home size={18} /> },
    { labelKey: "nav.search", fallback: "Search", href: "/field-worker/search", icon: <Search size={18} /> },
    { labelKey: "nav.newRecord", fallback: "New", href: "/field-worker/register", icon: <Plus size={18} /> },
    { labelKey: "nav.conflicts", fallback: "Conflicts", href: "/field-worker/conflicts", icon: <AlertTriangle size={18} /> },
    { labelKey: "nav.status", fallback: "Status", href: "/field-worker/status", icon: <Activity size={18} /> },
  ],
  supervisor: [
    { labelKey: "nav.dashboard", fallback: "Dashboard", href: "/supervisor/dashboard", icon: <LayoutDashboard size={18} /> },
    { labelKey: "nav.newRecord", fallback: "New", href: "/field-worker/register", icon: <Plus size={18} /> },
    { labelKey: "nav.search", fallback: "Search", href: "/field-worker/search", icon: <Search size={18} /> },
    { labelKey: "nav.reviewQueue", fallback: "Review", href: "/supervisor/review", icon: <Inbox size={18} /> },
    { labelKey: "nav.conflicts", fallback: "Conflicts", href: "/supervisor/conflicts", icon: <AlertTriangle size={18} /> },
    { labelKey: "nav.inventory", fallback: "Inventory", href: "/supervisor/inventory", icon: <Package size={18} /> },
    { labelKey: "nav.settings", fallback: "Settings", href: "/supervisor/settings", icon: <Settings size={18} /> },
  ],
  admin: [
    { labelKey: "nav.dashboard", fallback: "Dashboard", href: "/admin/dashboard", icon: <LayoutDashboard size={18} /> },
    { labelKey: "nav.workflows", fallback: "Workflows", href: "/admin/workflows", icon: <Workflow size={18} /> },
    { labelKey: "nav.records", fallback: "Records", href: "/field-worker/home", icon: <Home size={18} /> },
    { labelKey: "nav.newRecord", fallback: "New record", href: "/field-worker/register", icon: <Plus size={18} /> },
    { labelKey: "nav.search", fallback: "Search", href: "/field-worker/search", icon: <Search size={18} /> },
    { labelKey: "nav.reviewQueue", fallback: "Review", href: "/supervisor/review", icon: <Inbox size={18} /> },
    { labelKey: "nav.inventory", fallback: "Inventory", href: "/supervisor/inventory", icon: <Package size={18} /> },
    { labelKey: "nav.conflicts", fallback: "Conflicts", href: "/supervisor/conflicts", icon: <AlertTriangle size={18} /> },
    { labelKey: "nav.users", fallback: "Users", href: "/admin/users", icon: <Users size={18} /> },
    { labelKey: "nav.settings", fallback: "Settings", href: "/admin/settings", icon: <Settings size={18} /> },
  ],
  engineering: [
    { labelKey: "nav.engineering", fallback: "Engineering", href: "/engineering", icon: <Activity size={18} /> },
    { labelKey: "nav.admin", fallback: "Admin", href: "/admin/dashboard", icon: <LayoutDashboard size={18} /> },
  ],
}

export function MobileAccountMenu({ role }: { role: AppRole }) {
  const [open, setOpen] = useState(false)
  const { user, org, logout } = useAuthStore()
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const items = mobileNavByRole[role] ?? mobileNavByRole.field_worker

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {})
    await clearClientSessionState()
    logout()
    setOpen(false)
    router.push("/")
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-9 z-30 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-graph-line bg-white text-ink-black shadow-sm transition-colors hover:bg-graph-paper lg:hidden"
        aria-label={t("nav.menu", "Menu")}
        aria-expanded={open}
      >
        <Menu size={19} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-black/35 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label={t("common.close", "Close")}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(21rem,calc(100vw-2rem))] flex-col overflow-hidden border-r border-graph-line bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-graph-line px-4 py-4">
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold text-lake-deep">FieldFlow</p>
                <p className="mt-0.5 text-xs text-pencil">{t("app.tagline")}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
                aria-label={t("common.close", "Close")}
              >
                <X size={18} />
              </button>
            </div>

            <div className="border-b border-graph-line px-4 py-4">
              <OrgSwitcher />
              {(role === "field_worker" || role === "supervisor" || role === "admin") && (
                <div className="mt-3">
                  <WorkflowSwitcher compact />
                </div>
              )}
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {items.map((item) => {
                const active = pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      active ? "bg-ink-blue text-white" : "text-pencil hover:bg-graph-paper hover:text-ink-black",
                    )}
                  >
                    <span className="flex w-6 shrink-0 items-center justify-center">{item.icon}</span>
                    <span className="truncate">{t(item.labelKey, item.fallback)}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="border-t border-graph-line px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-clay text-sm font-semibold text-white">
                  {user?.name?.charAt(0) ?? "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-black">{user?.name ?? t("auth.demoUser", "Demo user")}</p>
                  <p className="truncate text-xs text-pencil">{org?.name || t("workspace.current", "Workspace")}</p>
                  <p className="truncate text-[10px] uppercase tracking-wider text-pencil">{t(`roles.${user?.role || role}`, (user?.role || role).replace("_", " "))}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-pencil transition-colors hover:bg-graph-paper hover:text-rebar"
                  aria-label={t("auth.logout", "Log out")}
                >
                  <LogOut size={17} />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
