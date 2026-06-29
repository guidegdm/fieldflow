"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import {
  cacheOfflineRecordRoutes,
  hydrateDemoSandboxOffline,
  loadOfflineDemoSandbox,
  persistDemoSandbox,
  type DemoOfflineWorkspace,
  type DemoOfflineAccount,
} from "@/lib/demo/offline-demo-cache"

const WARMUP_STORAGE_KEY = "fieldflow-offline-warmup-v1"

const APP_ROUTES_TO_CACHE = [
  "/",
  "/demo",
  "/auth/signin",
  "/auth/signup",
  "/auth/setup",
  "/engineering",
  "/admin/dashboard",
  "/admin/workflows",
  "/admin/workflows/new",
  "/admin/workflows/wf-1",
  "/admin/users",
  "/admin/settings",
  "/field-worker/home",
  "/field-worker/register",
  "/field-worker/search",
  "/field-worker/conflicts",
  "/field-worker/status",
  "/supervisor/dashboard",
  "/supervisor/review",
  "/supervisor/inventory",
  "/supervisor/conflicts",
  "/supervisor/settings",
]

type DemoWarmupResponse = {
  expiresAt?: number
  offlineWorkspaces?: DemoOfflineWorkspace[]
  offlineAccounts?: DemoOfflineAccount[]
}

function runWhenIdle(task: () => void) {
  const browserWindow = window as Window & typeof globalThis & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    cancelIdleCallback?: (handle: number) => void
  }

  if (browserWindow.requestIdleCallback && browserWindow.cancelIdleCallback) {
    const idleId = browserWindow.requestIdleCallback(task, { timeout: 6000 })
    return () => browserWindow.cancelIdleCallback?.(idleId)
  }
  const timeout = globalThis.setTimeout(task, 1500)
  return () => globalThis.clearTimeout(timeout)
}

async function cacheAppRoutes() {
  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const worker = registration?.active || registration?.waiting || registration?.installing
  if (!worker) return

  await new Promise<void>((resolve) => {
    const channel = new MessageChannel()
    const timeout = globalThis.setTimeout(resolve, 10000)
    channel.port1.onmessage = () => {
      globalThis.clearTimeout(timeout)
      resolve()
    }
    worker.postMessage(
      {
        type: "CACHE_URLS",
        payload: {
          urlsToCache: APP_ROUTES_TO_CACHE.map((url) => [
            new URL(url, window.location.origin).href,
            { credentials: "include" },
          ]),
        },
      },
      [channel.port2],
    )
  })
}

async function warmDemoSandbox() {
  const existing = loadOfflineDemoSandbox()
  if (existing && existing.savedAt > Date.now() - 6 * 60 * 60 * 1000) {
    await cacheOfflineRecordRoutes(existing.workspaces)
    return
  }

  const response = await fetch("/api/demo/offline", {
    credentials: "include",
    cache: "no-store",
  })
  if (!response.ok) return

  const data = (await response.json()) as DemoWarmupResponse
  if (!data.expiresAt || !data.offlineWorkspaces?.length || !data.offlineAccounts?.length) return

  await hydrateDemoSandboxOffline(data.offlineWorkspaces)
  await cacheOfflineRecordRoutes(data.offlineWorkspaces)
  persistDemoSandbox({
    expiresAt: data.expiresAt,
    workspaces: data.offlineWorkspaces,
    accounts: data.offlineAccounts,
  })
}

export function OfflineWarmup() {
  const pathname = usePathname()

  useEffect(() => {
    if (!navigator.onLine) return

    let cancelled = false
    void cacheAppRoutes()
    const shouldWarmDemo =
      pathname === "/" ||
      pathname === "/demo" ||
      pathname === "/auth/signin" ||
      pathname === "/auth/signup"

    const connection = "connection" in navigator
      ? (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
      : undefined
    const connectionIsConstrained = Boolean(connection?.saveData || connection?.effectiveType === "2g")

    if (!shouldWarmDemo || connectionIsConstrained) {
      return () => {
        cancelled = true
      }
    }

    const cancelIdle = runWhenIdle(() => {
      if (cancelled) return
      warmDemoSandbox()
        .then(() => {
          try {
            window.localStorage.setItem(WARMUP_STORAGE_KEY, String(Date.now()))
          } catch {}
        })
        .catch(() => {})
    })

    return () => {
      cancelled = true
      cancelIdle()
    }
  }, [pathname])

  return null
}
