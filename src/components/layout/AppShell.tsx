"use client"

import { Component, type ReactNode } from "react"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { ConnectivityBar } from "@/components/layout/ConnectivityBar"
import { TabBar } from "@/components/layout/TabBar"
import { Drawer } from "@/components/layout/Drawer"
import { LanguageToggle } from "@/components/layout/LanguageToggle"
import { cn } from "@/lib/utils"

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
        <div className="min-h-[50vh] px-4 py-10 sm:px-6 lg:px-8">
          <div className="max-w-xl rounded-md border border-danger-500/30 bg-danger-500/5 p-4">
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

export function RouteHydrationFallback() {
  return (
    <div className="min-h-screen bg-white">
      <ConnectivityBar />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-8 w-48 rounded-md bg-graph-line/70" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-28 rounded-md border border-graph-line bg-white p-4">
              <div className="h-3 w-20 rounded bg-graph-line/70" />
              <div className="mt-5 h-8 w-16 rounded bg-graph-line/60" />
            </div>
          ))}
        </div>
        <div className="mt-6 h-64 rounded-md border border-graph-line bg-white p-4">
          <div className="h-4 w-40 rounded bg-graph-line/70" />
          <div className="mt-6 space-y-3">
            <div className="h-10 rounded bg-graph-line/50" />
            <div className="h-10 rounded bg-graph-line/40" />
            <div className="h-10 rounded bg-graph-line/30" />
          </div>
        </div>
      </main>
    </div>
  )
}

export function AppShell({ children, role }: AppShellProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  return (
    <div className="min-h-screen bg-white">
      <ConnectivityBar />
      {isDesktop ? <Drawer role={role} open onToggle={() => {}} /> : <TabBar role={role} />}
      <main className={cn("min-h-[calc(100vh-28px)] pb-24 lg:pb-0", isDesktop && "lg:pl-64")}>
        <div className="fixed right-3 top-9 z-30 sm:right-4 lg:right-6">
          <LanguageToggle />
        </div>
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <AppShellErrorBoundary>{children}</AppShellErrorBoundary>
        </div>
      </main>
    </div>
  )
}
