"use client"

import { useState } from "react"
import { Component, type ReactNode } from "react"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { ConnectivityBar } from "@/components/layout/ConnectivityBar"
import { TabBar } from "@/components/layout/TabBar"
import { Drawer } from "@/components/layout/Drawer"
import { LanguageToggle } from "@/components/layout/LanguageToggle"

interface AppShellProps {
  children: React.ReactNode
  role: "admin" | "supervisor" | "field_worker" | "engineering"
}

class AppShellErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error("[AppShell] render failure", error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] px-6 py-12">
          <div className="max-w-xl border border-danger-500/30 bg-danger-500/5 p-4">
            <h1 className="font-display text-2xl text-danger-500">Erreur d'application</h1>
            <p className="mt-2 text-sm text-ink-black">
              Rechargez la page. Les données locales restent conservées sur cet appareil.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 h-10 rounded-md bg-ink-blue px-4 text-sm font-medium text-white"
            >
              Réessayer
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
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
        <AppShellErrorBoundary>{children}</AppShellErrorBoundary>
      </main>
    </div>
  )
}
