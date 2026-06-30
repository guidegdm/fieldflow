"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import {
  cacheOfflineRecordRoutes,
  hydrateAuthenticatedUserOffline,
  hydrateDemoWorkspaceOffline,
  hydrateDemoSandboxOffline,
  loadOfflineDemoSandbox,
  persistDemoSandbox,
  type DemoOfflineWorkspace,
  type DemoOfflineAccount,
} from "@/lib/demo/offline-demo-cache"
import { db } from "@/lib/db/indexeddb"
import { useAuthStore } from "@/stores/authStore"
import type { DemoUser } from "@/types/auth"

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
  const urls = Array.from(new Set([...APP_ROUTES_TO_CACHE, window.location.pathname]))

  if ("caches" in window) {
    const cache = await caches.open("fieldflow-pages")
    await Promise.all(urls.map(async (url) => {
      try {
        const request = new Request(new URL(url, window.location.origin).href, {
          credentials: "include",
          cache: "reload",
          headers: { Accept: "text/html,application/xhtml+xml" },
        })
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        if (response.ok) await cache.put(new URL(url, window.location.origin).href, response.clone())
      } catch {}
    }))
  }

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
          urlsToCache: urls.map((url) => [
            new URL(url, window.location.origin).href,
            { credentials: "include" },
          ]),
        },
      },
      [channel.port2],
    )
  })
}

async function cacheUrls(urls: string[]) {
  const unique = Array.from(new Set(urls.filter(Boolean)))
  if (!unique.length) return

  if ("caches" in window) {
    const cache = await caches.open("fieldflow-pages")
    await Promise.all(unique.map(async (url) => {
      try {
        const request = new Request(new URL(url, window.location.origin).href, {
          credentials: "include",
          cache: "reload",
          headers: { Accept: "text/html,application/xhtml+xml" },
        })
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        if (response.ok) await cache.put(new URL(url, window.location.origin).href, response.clone())
      } catch {}
    }))
  }

  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const worker = registration?.active || registration?.waiting || registration?.installing
  if (!worker) return

  await new Promise<void>((resolve) => {
    const channel = new MessageChannel()
    const timeout = globalThis.setTimeout(resolve, 12000)
    channel.port1.onmessage = () => {
      globalThis.clearTimeout(timeout)
      resolve()
    }
    worker.postMessage(
      {
        type: "CACHE_URLS",
        payload: {
          urlsToCache: unique.map((url) => [
            new URL(url, window.location.origin).href,
            { credentials: "include" },
          ]),
        },
      },
      [channel.port2],
    )
  })
}

async function cacheCurrentWorkspaceRoutes(user?: DemoUser | null) {
  if (!user?.orgId) return
  const orgs = (user as DemoUser & { orgs?: Array<{ id: string; name?: string }> }).orgs?.length
    ? (user as DemoUser & { orgs?: Array<{ id: string; name?: string }> }).orgs!
    : [{ id: user.orgId }]
  const orgIds = Array.from(new Set(orgs.map((org) => org.id).filter(Boolean)))
  const workspaceData = await Promise.all(orgIds.map(async (orgId) => {
    const [workflows, records] = await Promise.all([
      db.getAllWorkflowsForOrg(orgId).catch(() => []),
      db.getAllRecordsForOrg(orgId).catch(() => []),
    ])
    return { workflows, records }
  }))

  await cacheUrls([
    ...APP_ROUTES_TO_CACHE,
    ...workspaceData.flatMap(({ workflows }) => workflows.flatMap((workflow) => [
      `/admin/workflows/${workflow.id}`,
    ])),
    ...workspaceData.flatMap(({ records }) => records.map((record) => `/field-worker/record/${record.id}`)),
    ...workspaceData.flatMap(({ records }) => records.map((record) => `/supervisor/review?id=${record.id}`)),
  ])
}

async function warmCurrentUserWorkspace(user?: DemoUser | null) {
  if (!user?.orgId) return
  await hydrateAuthenticatedUserOffline(user).catch(() => hydrateDemoWorkspaceOffline(user).catch(() => {}))
  await cacheInventory(user).catch(() => {})
  await cacheCurrentWorkspaceRoutes(user)
}

async function cacheInventory(user?: DemoUser | null) {
  if (!user?.orgId || typeof window === "undefined") return
  const orgs = (user as DemoUser & { orgs?: Array<{ id: string; name?: string }> }).orgs?.length
    ? (user as DemoUser & { orgs?: Array<{ id: string; name?: string }> }).orgs!
    : [{ id: user.orgId }]
  for (const org of orgs) {
    try {
      const response = await fetch("/api/critical/inventory", {
        credentials: "include",
        cache: "no-store",
        headers: { "x-fieldflow-org-id": org.id },
      })
      if (!response.ok) continue
      window.localStorage.setItem(`fieldflow-inventory-${org.id}`, JSON.stringify({
        savedAt: Date.now(),
        items: await response.json(),
      }))
    } catch {}
  }
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
  if ("caches" in window) {
    const cache = await caches.open("fieldflow-pages")
    const workflowUrls = data.offlineWorkspaces.flatMap((workspace) =>
      workspace.workflows.flatMap((workflow) => [
        `/admin/workflows/${workflow.id}`,
        `/api/workflows/${workflow.id}/definition`,
        `/api/workflows/${workflow.id}/records`,
      ]),
    )
    await Promise.all(Array.from(new Set(workflowUrls)).map(async (url) => {
      try {
        const request = new Request(new URL(url, window.location.origin).href, {
          credentials: "include",
          cache: "reload",
        })
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
      } catch {}
    }))
  }
  persistDemoSandbox({
    expiresAt: data.expiresAt,
    workspaces: data.offlineWorkspaces,
    accounts: data.offlineAccounts,
  })
}

export function OfflineWarmup() {
  const pathname = usePathname()
  const user = useAuthStore((state) => state.user)
  const orgs = useAuthStore((state) => state.orgs)
  const warmupUser = user ? { ...user, orgs } : null

  useEffect(() => {
    if (!navigator.onLine) return

    let cancelled = false
    void cacheAppRoutes()
    void warmCurrentUserWorkspace(warmupUser)
    const connection = "connection" in navigator
      ? (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
      : undefined
    const connectionIsConstrained = Boolean(connection?.saveData || connection?.effectiveType === "2g")

    if (connectionIsConstrained) {
      return () => {
        cancelled = true
      }
    }

    void warmDemoSandbox()
      .then(() => {
        try {
          window.localStorage.setItem(WARMUP_STORAGE_KEY, String(Date.now()))
        } catch {}
      })
      .catch(() => {})

    const cancelIdle = runWhenIdle(() => {
      if (cancelled) return
      Promise.all([warmDemoSandbox(), warmCurrentUserWorkspace(warmupUser)])
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
  }, [pathname, warmupUser?.orgId, warmupUser?.id, orgs.map((org) => org.id).join("|")])

  return null
}
