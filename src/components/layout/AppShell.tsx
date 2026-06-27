"use client"

import { useState } from "react"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { ConnectivityBar } from "@/components/layout/ConnectivityBar"
import { TabBar } from "@/components/layout/TabBar"
import { Drawer } from "@/components/layout/Drawer"

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
        className={
          isMobile
            ? "pt-7 pb-16"
            : "pt-7 pl-10"
        }
      >
        {children}
      </main>
    </div>
  )
}
