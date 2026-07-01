"use client"

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

type RelatedApp = {
  platform?: string
  url?: string
  id?: string
}

type InstallAwareNavigator = Navigator & {
  standalone?: boolean
  getInstalledRelatedApps?: () => Promise<RelatedApp[]>
}

export const INSTALL_DISMISSED_KEY = "fieldflow-install-dismissed"
export const INSTALL_MARKED_KEY = "fieldflow-installed"

export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false
  const nav = navigator as InstallAwareNavigator
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone)
}

export function markFieldFlowInstalled() {
  if (typeof window === "undefined") return
  window.localStorage.setItem(INSTALL_MARKED_KEY, "1")
  window.localStorage.removeItem(INSTALL_DISMISSED_KEY)
}

export function markFieldFlowInstallDismissed() {
  if (typeof window === "undefined") return
  window.localStorage.setItem(INSTALL_DISMISSED_KEY, "1")
}

export async function hasInstalledRelatedFieldFlow() {
  if (typeof navigator === "undefined") return false
  const nav = navigator as InstallAwareNavigator
  if (!nav.getInstalledRelatedApps) return false

  const apps = await nav.getInstalledRelatedApps().catch(() => [])
  return apps.some((app) => {
    const url = app.url || ""
    const id = app.id || ""
    return app.platform === "webapp" && (url.includes("/manifest.webmanifest") || id === "/" || id === "fieldflow")
  })
}

export async function shouldSuppressInstallUi() {
  if (typeof window === "undefined") return true
  if (isStandaloneDisplay()) {
    markFieldFlowInstalled()
    return true
  }
  if (window.localStorage.getItem(INSTALL_MARKED_KEY) === "1") return true
  if (await hasInstalledRelatedFieldFlow()) {
    markFieldFlowInstalled()
    return true
  }
  return false
}
