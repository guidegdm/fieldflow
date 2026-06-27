"use client"

import { useState } from "react"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { ConnectivityBar } from "@/components/layout/ConnectivityBar"
import { TabBar } from "@/components/layout/TabBar"
import { Drawer } from "@/components/layout/Drawer"
import { LanguageToggle } from "@/components/layout/LanguageToggle"

interface AppShellProps {
  children: React.ReactNode
  role: "admin" | "supervisor" | "field_worker"
}

export function AppShell({ children, role }: AppShellProps) {
  const isMobile = useMediaQuery("(max-width: 767px)")
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white">
      <ConnectivityBar />
      {isMobile ? (
        <TabBar role={role} />
      ) : (
        <Drawer
          role={role}
          open={drawerOpen}
          onToggle={() => setDrawerOpen((v) => !v)}
        />
      )}
      <main
        className="pt-7 pb-16"
        style={!isMobile ? { marginLeft: drawerOpen ? 200 : 40, transition: "margin-left 200ms ease-out" } : undefined}
      >
        <div className="fixed top-7 right-4 z-30">
          <LanguageToggle />
        </div>
        {children}
      </main>
    </div>
  )
}
