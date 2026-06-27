"use client"

import { useAuthStore } from "@/stores/authStore"
import { OrgSwitcher } from "@/components/layout/OrgSwitcher"
import { cn } from "@/lib/utils"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard, Workflow, Users, Settings, Home, Search,
  Activity, Inbox, AlertTriangle, Package, Plus, Menu, LogOut,
} from "lucide-react"

interface DrawerProps { role: "admin" | "supervisor" | "field_worker" | "engineering"; open: boolean; onToggle: () => void }

const navByRole: Record<string, { label: string; href: string; icon: React.ReactNode }[]> = {
  field_worker: [
    { label: "Accueil", href: "/field-worker/home", icon: <Home size={20} /> },
    { label: "Rechercher", href: "/field-worker/search", icon: <Search size={20} /> },
    { label: "Nouveau", href: "/field-worker/register", icon: <Plus size={20} /> },
    { label: "Conflits", href: "/field-worker/conflicts", icon: <AlertTriangle size={20} /> },
    { label: "Statut", href: "/field-worker/status", icon: <Activity size={20} /> },
  ],
  supervisor: [
    { label: "Tableau de bord", href: "/supervisor/dashboard", icon: <LayoutDashboard size={20} /> },
    { label: "File d'attente", href: "/supervisor/review", icon: <Inbox size={20} /> },
    { label: "Conflits", href: "/supervisor/conflicts", icon: <AlertTriangle size={20} /> },
    { label: "Inventaire", href: "/supervisor/inventory", icon: <Package size={20} /> },
    { label: "Paramètres", href: "/supervisor/settings", icon: <Settings size={20} /> },
  ],
  admin: [
    { label: "Tableau de bord", href: "/admin/dashboard", icon: <LayoutDashboard size={20} /> },
    { label: "Workflows", href: "/admin/workflows", icon: <Workflow size={20} /> },
    { label: "Utilisateurs", href: "/admin/users", icon: <Users size={20} /> },
    { label: "Paramètres", href: "/admin/settings", icon: <Settings size={20} /> },
  ],
  engineering: [
    { label: "Engineering", href: "/engineering", icon: <Activity size={20} /> },
    { label: "Admin", href: "/admin/dashboard", icon: <LayoutDashboard size={20} /> },
  ],
}

export function Drawer({ role, open, onToggle }: DrawerProps) {
  const { user, logout } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()
  const items = navByRole[role] ?? navByRole.field_worker

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {})
    logout()
    router.push("/")
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-7 h-[calc(100vh-28px)] bg-kivu-paper border-r border-graph-line z-40 flex flex-col transition-all duration-200 ease-out overflow-hidden",
        open ? "w-[200px]" : "w-[40px]",
      )}
    >
      <div className="flex items-center justify-center h-12 shrink-0">
        <button onClick={onToggle} className="w-8 h-8 flex items-center justify-center rounded-md text-pencil hover:text-ink-black hover:bg-black/5" aria-label={open ? "Fermer" : "Ouvrir"}>
          <Menu size={18} />
        </button>
      </div>

      {open && (
        <div className="px-3 pb-2">
          <OrgSwitcher />
        </div>
      )}

      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 px-2 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
              isActive ? "bg-ink-blue/10 text-lake-deep" : "text-pencil hover:text-ink-black hover:bg-black/5",
            )}>
              <span className="w-8 flex items-center justify-center shrink-0">{item.icon}</span>
              {open && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {user && (
        <div className={cn("border-t border-graph-line", open ? "px-3 py-3" : "px-1 py-2")}>
          <div className={cn("flex items-center", open ? "gap-3" : "justify-center")}>
            <div className="w-8 h-8 rounded bg-clay flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {user.name?.charAt(0) ?? "U"}
            </div>
            {open && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-black truncate">{user.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-pencil">{role.replace("_", " ")}</p>
                </div>
                <button onClick={handleLogout} className="p-1.5 text-pencil hover:text-rebar hover:bg-black/5 rounded-md" aria-label="Déconnexion">
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
