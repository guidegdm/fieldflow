"use client"

import { useAuthStore } from "@/stores/authStore"
import { OrgSwitcher } from "@/components/layout/OrgSwitcher"
import { WorkflowSwitcher } from "@/components/layout/WorkflowSwitcher"
import { LanguagePreferenceSelect } from "@/components/layout/LanguagePreferenceSelect"
import { cn } from "@/lib/utils"
import { clearClientSessionState } from "@/lib/auth/client-session-cleanup"
import { usePathname, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import {
  LayoutDashboard, Workflow, Users, Settings, Home, Search,
  Activity, Inbox, AlertTriangle, Package, Plus, LogOut,
} from "lucide-react"

interface DrawerProps { role: "admin" | "supervisor" | "field_worker" | "engineering"; open: boolean; onToggle: () => void }

const navByRole: Record<string, { labelKey: string; fallback: string; href: string; icon: React.ReactNode }[]> = {
  field_worker: [
    { labelKey: "nav.dashboard", fallback: "Dashboard", href: "/field-worker/home", icon: <LayoutDashboard size={20} /> },
    { labelKey: "nav.search", fallback: "Rechercher", href: "/field-worker/search", icon: <Search size={20} /> },
    { labelKey: "nav.newRecord", fallback: "Nouveau", href: "/field-worker/register", icon: <Plus size={20} /> },
    { labelKey: "nav.conflicts", fallback: "Conflits", href: "/field-worker/conflicts", icon: <AlertTriangle size={20} /> },
    { labelKey: "nav.status", fallback: "Statut", href: "/field-worker/status", icon: <Activity size={20} /> },
    { labelKey: "nav.settings", fallback: "Paramètres", href: "/account/settings", icon: <Settings size={20} /> },
  ],
  supervisor: [
    { labelKey: "nav.dashboard", fallback: "Tableau de bord", href: "/supervisor/dashboard", icon: <LayoutDashboard size={20} /> },
    { labelKey: "nav.newRecord", fallback: "Nouvelle fiche", href: "/field-worker/register", icon: <Plus size={20} /> },
    { labelKey: "nav.search", fallback: "Rechercher", href: "/field-worker/search", icon: <Search size={20} /> },
    { labelKey: "nav.reviewQueue", fallback: "File d'attente", href: "/supervisor/review", icon: <Inbox size={20} /> },
    { labelKey: "nav.conflicts", fallback: "Conflits", href: "/supervisor/conflicts", icon: <AlertTriangle size={20} /> },
    { labelKey: "nav.inventory", fallback: "Inventaire", href: "/supervisor/inventory", icon: <Package size={20} /> },
    { labelKey: "nav.settings", fallback: "Paramètres", href: "/account/settings", icon: <Settings size={20} /> },
  ],
  admin: [
    { labelKey: "nav.dashboard", fallback: "Tableau de bord", href: "/admin/dashboard", icon: <LayoutDashboard size={20} /> },
    { labelKey: "nav.workflows", fallback: "Workflows", href: "/admin/workflows", icon: <Workflow size={20} /> },
    { labelKey: "nav.records", fallback: "Fiches", href: "/field-worker/home", icon: <Home size={20} /> },
    { labelKey: "nav.newRecord", fallback: "Nouvelle fiche", href: "/field-worker/register", icon: <Plus size={20} /> },
    { labelKey: "nav.search", fallback: "Recherche terrain", href: "/field-worker/search", icon: <Search size={20} /> },
    { labelKey: "nav.reviewQueue", fallback: "Validation", href: "/supervisor/review", icon: <Inbox size={20} /> },
    { labelKey: "nav.inventory", fallback: "Inventaire", href: "/supervisor/inventory", icon: <Package size={20} /> },
    { labelKey: "nav.conflicts", fallback: "Conflits", href: "/supervisor/conflicts", icon: <AlertTriangle size={20} /> },
    { labelKey: "nav.users", fallback: "Utilisateurs", href: "/admin/users", icon: <Users size={20} /> },
    { labelKey: "nav.settings", fallback: "Paramètres", href: "/account/settings", icon: <Settings size={20} /> },
  ],
  engineering: [
    { labelKey: "nav.engineering", fallback: "Engineering", href: "/engineering", icon: <Activity size={20} /> },
    { labelKey: "nav.admin", fallback: "Admin", href: "/admin/dashboard", icon: <LayoutDashboard size={20} /> },
  ],
}

export function Drawer({ role, open, onToggle }: DrawerProps) {
  const { user, org, logout } = useAuthStore()
  const { t } = useTranslation()
  const pathname = usePathname()
  const router = useRouter()
  const items = navByRole[role] ?? navByRole.field_worker

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {})
    await clearClientSessionState()
    logout()
    router.push("/")
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-7 z-40 hidden h-[calc(100vh-28px)] w-64 flex-col overflow-hidden border-r border-graph-line bg-kivu-paper lg:flex",
      )}
    >
      <div className="shrink-0 px-4 py-4">
        <p className="font-display text-xl font-semibold text-lake-deep">FieldFlow</p>
        <p className="mt-0.5 text-xs text-pencil">{t("app.tagline")}</p>
      </div>

      <div className="px-4 pb-3">
        <OrgSwitcher />
      </div>

      {(role === "field_worker" || role === "supervisor" || role === "admin") && (
        <div className="px-4 pb-3">
          <WorkflowSwitcher />
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              isActive ? "bg-ink-blue text-white" : "text-pencil hover:bg-white hover:text-ink-black",
            )}>
              <span className="flex w-6 shrink-0 items-center justify-center">{item.icon}</span>
              <span className="truncate">{t(item.labelKey, item.fallback)}</span>
            </Link>
          )
        })}
      </nav>

      {user && (
        <div className="space-y-3 border-t border-graph-line px-4 py-4">
          <LanguagePreferenceSelect compact />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-clay flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {user.name?.charAt(0) ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-black">{user.name}</p>
              <p className="truncate text-xs text-pencil">{org?.name || t("workspace.current", "Workspace")}</p>
              <p className="truncate text-[10px] uppercase tracking-wider text-pencil">{t(`roles.${user.role}`, user.role.replace("_", " "))}</p>
            </div>
            <button onClick={handleLogout} className="rounded-md p-2 text-pencil hover:bg-white hover:text-rebar" aria-label={t("auth.logout")}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
