/**
 * @deprecated Use `Drawer` instead. `AppShell` renders `Drawer` on desktop.
 */
"use client"

import { useAuthStore } from "@/stores/authStore"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  Workflow,
  Inbox,
  AlertTriangle,
  Package,
  LogOut,
} from "lucide-react"
import { clearClientSessionState } from "@/lib/auth/client-session-cleanup"

interface SidebarProps {
  role: "admin" | "supervisor"
}

type NavItem = { label: string; href: string; icon: React.ReactNode }

const adminLinks: NavItem[] = [
  { label: "Tableau de bord", href: "/admin/dashboard", icon: <LayoutDashboard size={18} /> },
  { label: "Workflows", href: "/admin/workflows", icon: <Workflow size={18} /> },
]

const supervisorLinks: NavItem[] = [
  { label: "Tableau de bord", href: "/supervisor/dashboard", icon: <LayoutDashboard size={18} /> },
  { label: "File d'attente", href: "/supervisor/review", icon: <Inbox size={18} /> },
  { label: "Conflits", href: "/supervisor/conflicts", icon: <AlertTriangle size={18} /> },
  { label: "Inventaire", href: "/supervisor/inventory", icon: <Package size={18} /> },
]

export function Sidebar({ role }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const links = role === "admin" ? adminLinks : supervisorLinks
  const activeHref = usePathname()

  if (!user) return null

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {})
    await clearClientSessionState()
    logout()
    window.location.href = "/"
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-grid-line flex flex-col z-40">
      <div className="px-5 pt-6 pb-4">
        <h1 className="font-display text-xl text-lake-deep tracking-tight">FieldFlow</h1>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {links.map((link) => {
          const isActive = activeHref.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-ink-blue/5 text-lake-deep"
                  : "text-pencil hover:bg-graph-paper hover:text-ink-black",
              )}
            >
              {link.icon}
              <span>{link.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-grid-line">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-clay flex items-center justify-center text-white text-sm font-semibold">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink-black truncate">{user.name}</p>
            <span className="inline-block text-[11px] uppercase tracking-wider text-pencil bg-graph-paper px-1.5 py-0.5 rounded">
              {role}
            </span>
          </div>
          <button
            onClick={() => void handleLogout()}
            className="p-1.5 text-pencil hover:text-rebar hover:bg-graph-paper rounded-md transition-colors"
            aria-label="Déconnexion"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
