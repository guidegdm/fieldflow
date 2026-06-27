"use client"

import { cn } from "@/lib/utils"
import {
  Home,
  Search,
  Plus,
  Activity,
  Inbox,
  AlertTriangle,
  Package,
  Settings,
  LayoutDashboard,
  Workflow,
  Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslation } from "react-i18next"

interface TabBarProps {
  role: "admin" | "supervisor" | "field_worker" | "engineering"
}

type TabItem = { labelKey: string; fallback: string; href: string; icon: typeof Home }

type TabConfig = {
  tabs: TabItem[]
  plusHref: string
  plusLabel: string
  plusIndex: number
}

const configByRole: Record<string, TabConfig> = {
  field_worker: {
    tabs: [
      { labelKey: "nav.home", fallback: "Accueil", href: "/field-worker/home", icon: Home },
      { labelKey: "nav.search", fallback: "Rechercher", href: "/field-worker/search", icon: Search },
      { labelKey: "nav.status", fallback: "Statut", href: "/field-worker/status", icon: Activity },
    ],
    plusHref: "/field-worker/register",
    plusLabel: "nav.newRecord",
    plusIndex: 2,
  },
  supervisor: {
    tabs: [
      { labelKey: "nav.reviewQueue", fallback: "File d'attente", href: "/supervisor/review", icon: Inbox },
      { labelKey: "nav.conflicts", fallback: "Conflits", href: "/supervisor/conflicts", icon: AlertTriangle },
      { labelKey: "nav.inventory", fallback: "Inventaire", href: "/supervisor/inventory", icon: Package },
      { labelKey: "nav.settings", fallback: "Paramètres", href: "/supervisor/settings", icon: Settings },
    ],
    plusHref: "/supervisor/review",
    plusLabel: "nav.reviewQueue",
    plusIndex: 3,
  },
  admin: {
    tabs: [
      { labelKey: "nav.dashboard", fallback: "Tableau de bord", href: "/admin/dashboard", icon: LayoutDashboard },
      { labelKey: "nav.workflows", fallback: "Workflows", href: "/admin/workflows", icon: Workflow },
      { labelKey: "nav.users", fallback: "Utilisateurs", href: "/admin/users", icon: Users },
      { labelKey: "nav.settings", fallback: "Paramètres", href: "/admin/settings", icon: Settings },
    ],
    plusHref: "/admin/workflows/new",
    plusLabel: "admin.newWorkflow",
    plusIndex: 3,
  },
  engineering: {
    tabs: [
      { labelKey: "nav.engineering", fallback: "Engineering", href: "/engineering", icon: Activity },
      { labelKey: "nav.admin", fallback: "Admin", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
    plusHref: "/engineering",
    plusLabel: "nav.engineering",
    plusIndex: 1,
  },
}

export function TabBar({ role }: TabBarProps) {
  const { t } = useTranslation()
  const pathname = usePathname()
  const config = configByRole[role] ?? configByRole.field_worker
  const { tabs, plusHref, plusLabel, plusIndex } = config

  const leftTabs = tabs.slice(0, plusIndex)
  const rightTabs = tabs.slice(plusIndex)

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-graph-line z-40">
      <div className="flex items-stretch h-full max-w-lg mx-auto px-3">
        {/* Left tabs */}
        {leftTabs.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={pathname.startsWith(tab.href)} />
        ))}

        {/* Center + button */}
        <div className="flex items-center justify-center w-20 shrink-0">
          <Link
            href={plusHref}
            aria-label={t(plusLabel)}
            className="w-14 h-14 -mt-5 rounded-full bg-ink-blue text-white flex items-center justify-center border-4 border-white shadow-md hover:bg-ink-blue/90 transition-colors active:scale-95"
          >
            <Plus size={24} strokeWidth={2.5} />
          </Link>
        </div>

        {/* Right tabs */}
        {rightTabs.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={pathname.startsWith(tab.href)} />
        ))}
      </div>
    </nav>
  )
}

function TabLink({
  tab,
  active,
}: {
  tab: TabItem
  active: boolean
}) {
  const { t } = useTranslation()
  const Icon = tab.icon
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[48px] min-h-[48px] relative",
        active && "border-t-2 border-ink-blue",
      )}
    >
      <Icon size={20} className={cn(active ? "text-ink-blue" : "text-pencil")} />
      <span className={cn("text-[10px] font-medium", active ? "text-ink-blue" : "text-pencil")}>
        {t(tab.labelKey, tab.fallback)}
      </span>
    </Link>
  )
}
