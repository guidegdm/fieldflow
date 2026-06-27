"use client"

import { cn } from "@/lib/utils"
import { Home, Search, Plus, Activity } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const tabs = [
  { label: "Accueil", href: "/field-worker/home", icon: Home },
  { label: "Rechercher", href: "/field-worker/search", icon: Search },
  { label: "Statut", href: "/field-worker/status", icon: Activity },
]

export function TabBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-grid-line z-40">
      <div className="flex items-stretch justify-between h-full max-w-lg mx-auto px-3 relative">
        {/* Left two tabs */}
        <div className="flex items-stretch flex-1">
          {tabs.slice(0, 2).map((tab) => (
            <TabLink key={tab.href} tab={tab} active={pathname === tab.href} />
          ))}
        </div>

        {/* Center primary action: new record */}
        <div className="flex items-center justify-center w-20 shrink-0">
          <Link
            href="/field-worker/register"
            aria-label="Nouvel enregistrement"
            className="w-14 h-14 -mt-5 rounded-full bg-ink-blue text-white flex items-center justify-center border-4 border-white shadow-md hover:bg-ink-blue/90 transition-colors"
          >
            <Plus size={24} strokeWidth={2.5} />
          </Link>
        </div>

        {/* Right tab(s) */}
        <div className="flex items-stretch flex-1 justify-end">
          {tabs.slice(2).map((tab) => (
            <TabLink key={tab.href} tab={tab} active={pathname === tab.href} />
          ))}
        </div>
      </div>
    </nav>
  )
}

function TabLink({
  tab,
  active,
}: {
  tab: { label: string; href: string; icon: typeof Home }
  active: boolean
}) {
  const Icon = tab.icon
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className="flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[64px]"
    >
      <Icon size={20} className={cn(active ? "text-ink-blue" : "text-pencil")} />
      <span className={cn("text-[10px] font-medium", active ? "text-ink-blue" : "text-pencil")}>
        {tab.label}
      </span>
    </Link>
  )
}
