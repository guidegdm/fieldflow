"use client"

import { cn } from "@/lib/utils"
import { Home, Search, Plus, QrCode, Activity } from "lucide-react"

const tabs = [
  { label: "Accueil", href: "/field-worker/home", icon: Home },
  { label: "Rechercher", href: "/field-worker/search", icon: Search },
  { label: "Scanner", href: "/field-worker/scan", icon: QrCode },
  { label: "Statut", href: "/field-worker/status", icon: Activity },
]

export function TabBar() {
  const activeHref = typeof window !== "undefined" ? window.location.pathname : ""

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-grid-line z-40">
      <div className="flex items-center justify-around h-full max-w-lg mx-auto px-2 relative">
        {tabs.map((tab, i) => {
          const Icon = tab.icon
          const isActive = activeHref === tab.href
          if (i === 1) {
            return (
              <a key={tab.href} href={tab.href} className="flex flex-col items-center justify-center gap-0.5 flex-1">
                <Icon size={20} className={cn(isActive ? "text-ink-blue" : "text-pencil")} />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    isActive ? "text-ink-blue" : "text-pencil",
                  )}
                >
                  {tab.label}
                </span>
              </a>
            )
          }
          if (i === 3) {
            return (
              <a key={tab.href} href={tab.href} className="flex flex-col items-center justify-center gap-0.5 flex-1">
                <Icon size={20} className={cn(isActive ? "text-ink-blue" : "text-pencil")} />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    isActive ? "text-ink-blue" : "text-pencil",
                  )}
                >
                  {tab.label}
                </span>
              </a>
            )
          }
          return (
            <a key={tab.href} href={tab.href} className="flex flex-col items-center justify-center gap-0.5 flex-1">
              <Icon size={20} className={cn(isActive ? "text-ink-blue" : "text-pencil")} />
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-ink-blue" : "text-pencil",
                )}
              >
                {tab.label}
              </span>
            </a>
          )
        })}

        <button className="absolute bottom-3 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-ink-blue text-white flex items-center justify-center shadow-md hover:bg-ink-blue/90 transition-colors" aria-label="Ajouter">
          <Plus size={22} />
        </button>
      </div>
    </nav>
  )
}
