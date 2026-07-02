"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { usePromptQueueSlot } from "@/lib/ui/prompt-queue"

const VERSION_KEY = "fieldflow-app-version"
const UPDATE_PENDING_KEY = "fieldflow-update-pending"
const UPDATE_RELOAD_KEY = "fieldflow-update-reload"
const UPDATE_SNOOZE_KEY = "fieldflow-update-snooze"
const CHECK_INTERVAL_MS = 10 * 60 * 1000
const UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000
const UPDATE_PENDING_MS = 2 * 60 * 1000
const UPDATE_ROUTES_TO_CACHE = [
  "/",
  "/demo",
  "/auth/signin",
  "/auth/signup",
  "/auth/setup",
  "/admin/dashboard",
  "/admin/workflows",
  "/admin/users",
  "/field-worker/home",
  "/field-worker/register",
  "/field-worker/search",
  "/supervisor/dashboard",
  "/supervisor/review",
  "/supervisor/inventory",
]

type PendingUpdate = { version: string; startedAt: number }

function snoozeKey(version: string) {
  return `${UPDATE_SNOOZE_KEY}:${version}`
}

function isSnoozed(version: string) {
  const raw = window.localStorage.getItem(snoozeKey(version))
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) && Date.now() - value < UPDATE_SNOOZE_MS
}

async function fetchVersion() {
  const response = await fetch("/api/app-version", { cache: "no-store" })
  if (!response.ok) return null
  const body = await response.json() as { version?: unknown }
  return typeof body.version === "string" ? body.version : null
}

async function refreshServiceWorker() {
  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  await registration?.update().catch(() => {})
  return registration
}

function readPendingUpdate(): PendingUpdate | null {
  const raw = window.sessionStorage.getItem(UPDATE_PENDING_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PendingUpdate
    if (!parsed.version || !Number.isFinite(parsed.startedAt)) return null
    return parsed
  } catch {
    return null
  }
}

function writePendingUpdate(version: string) {
  window.sessionStorage.setItem(UPDATE_PENDING_KEY, JSON.stringify({ version, startedAt: Date.now() }))
}

function clearPendingUpdate() {
  window.sessionStorage.removeItem(UPDATE_PENDING_KEY)
  window.sessionStorage.removeItem(UPDATE_RELOAD_KEY)
}

function isFreshPending(version: string) {
  const pending = readPendingUpdate()
  return Boolean(pending?.version === version && Date.now() - pending.startedAt < UPDATE_PENDING_MS)
}

function waitForWorkerState(worker: ServiceWorker, states: ServiceWorkerState[], timeoutMs: number) {
  if (states.includes(worker.state)) return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => {
      worker.removeEventListener("statechange", onChange)
      resolve(false)
    }, timeoutMs)
    const onChange = () => {
      if (!states.includes(worker.state)) return
      window.clearTimeout(timer)
      worker.removeEventListener("statechange", onChange)
      resolve(true)
    }
    worker.addEventListener("statechange", onChange)
  })
}

function waitForControllerChange(timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener("controllerchange", onChange)
      resolve(false)
    }, timeoutMs)
    const onChange = () => {
      window.clearTimeout(timer)
      navigator.serviceWorker.removeEventListener("controllerchange", onChange)
      resolve(true)
    }
    navigator.serviceWorker.addEventListener("controllerchange", onChange)
  })
}

async function prepareServiceWorkerForReload() {
  if (!("serviceWorker" in navigator)) return true
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  if (!registration) return true

  await registration.update().catch(() => {})
  if (registration.installing) {
    await waitForWorkerState(registration.installing, ["installed", "activated", "redundant"], 15000)
  }
  if (registration.waiting) {
    const controllerChanged = waitForControllerChange(5000)
    registration.waiting.postMessage({ type: "SKIP_WAITING" })
    await controllerChanged
  }
  return !registration.installing
}

async function warmUpdateCache(version: string) {
  if (!("serviceWorker" in navigator)) return true
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const worker = registration?.active || registration?.waiting || registration?.installing
  if (!worker) return true
  const urls = Array.from(new Set([...UPDATE_ROUTES_TO_CACHE, window.location.pathname])).map((url) => [
    new URL(url, window.location.origin).href,
    { credentials: "include" },
  ])
  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(() => resolve(false), 15000)
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout)
      resolve(Boolean(event.data?.ok))
    }
    worker.postMessage({
      type: "CACHE_URLS",
      payload: {
        urlsToCache: urls,
        version,
        promote: true,
      },
    }, [channel.port2])
  })
}

export function AppUpdateManager() {
  const { t } = useTranslation()
  const [updateReady, setUpdateReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const pendingVersion = useRef<string | null>(null)
  const checking = useRef(false)
  const { canShow, release } = usePromptQueueSlot("update", updateReady)

  useEffect(() => {
    let mounted = true
    let registrationRef: ServiceWorkerRegistration | null = null

    const requestUpdatePrompt = async (version?: string) => {
      const latest = version || await fetchVersion()
      if (!latest || !mounted) return
      const current = window.localStorage.getItem(VERSION_KEY)
      if (!current) {
        window.localStorage.setItem(VERSION_KEY, latest)
        return
      }
      if (current === latest || isFreshPending(latest) || isSnoozed(latest)) return
      pendingVersion.current = latest
      setUpdateReady(true)
    }

    const watchRegistration = (registration: ServiceWorkerRegistration) => {
      registrationRef = registration
      if (registration.waiting && navigator.serviceWorker.controller) {
        void requestUpdatePrompt()
      }
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            void requestUpdatePrompt()
          }
        })
      })
    }

    const settleAppliedUpdate = async () => {
      const reloadedVersion = window.sessionStorage.getItem(UPDATE_RELOAD_KEY)
      const pending = readPendingUpdate()
      if (!pending && !reloadedVersion) return
      const latest = await fetchVersion()
      if (latest && reloadedVersion && latest === reloadedVersion) {
        window.localStorage.setItem(VERSION_KEY, latest)
        clearPendingUpdate()
        pendingVersion.current = null
        setUpdateReady(false)
        return
      }
      if (pending && Date.now() - pending.startedAt >= UPDATE_PENDING_MS) {
        clearPendingUpdate()
      }
    }

    const check = async () => {
      if (checking.current || !navigator.onLine) return
      checking.current = true
      try {
        const registration = await refreshServiceWorker()
        if (registration) registrationRef = registration
        if (registrationRef?.waiting && navigator.serviceWorker.controller) {
          await requestUpdatePrompt()
          return
        }
        const latest = await fetchVersion()
        if (!latest || !mounted) return
        const current = window.localStorage.getItem(VERSION_KEY)
        if (!current) {
          window.localStorage.setItem(VERSION_KEY, latest)
          return
        }
        if (current !== latest) await requestUpdatePrompt(latest)
      } finally {
        checking.current = false
      }
    }

    const onOnlineOrFocus = () => void check()
    const onServiceWorkerUpdated = () => void requestUpdatePrompt()
    const interval = window.setInterval(check, CHECK_INTERVAL_MS)
    window.addEventListener("online", onOnlineOrFocus)
    window.addEventListener("focus", onOnlineOrFocus)
    window.addEventListener("fieldflow:service-worker-updated", onServiceWorkerUpdated)
    void navigator.serviceWorker?.ready.then(watchRegistration).catch(() => {})
    void settleAppliedUpdate()
    void check()

    return () => {
      mounted = false
      window.clearInterval(interval)
      window.removeEventListener("online", onOnlineOrFocus)
      window.removeEventListener("focus", onOnlineOrFocus)
      window.removeEventListener("fieldflow:service-worker-updated", onServiceWorkerUpdated)
    }
  }, [])

  if (!canShow) return null

  const dismissForVersion = async () => {
    const latest = await fetchVersion()
    const version = latest || pendingVersion.current
    if (version) window.localStorage.setItem(snoozeKey(version), String(Date.now()))
    pendingVersion.current = null
    setUpdateReady(false)
    release()
  }

  const reload = async () => {
    const latest = await fetchVersion()
    const target = latest || pendingVersion.current
    if (!target) return
    setRefreshing(true)
    writePendingUpdate(target)
    try {
      if (!navigator.onLine) throw new Error("offline")
      const warmed = await warmUpdateCache(target)
      if (!warmed) throw new Error("update_warmup_failed")
      await prepareServiceWorkerForReload()
      window.sessionStorage.setItem(UPDATE_RELOAD_KEY, target)
      window.location.reload()
    } catch {
      clearPendingUpdate()
      setRefreshing(false)
      pendingVersion.current = target
      setUpdateReady(true)
    }
  }

  return (
    <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-xl border border-graph-line bg-white/95 p-3 shadow-xl backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-blue text-white">
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink-black">{t("pwa.updateTitle")}</p>
          <p className="mt-1 text-sm leading-5 text-pencil">{t("pwa.updateBody")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" loading={refreshing} disabled={refreshing} onClick={reload}>
              {refreshing ? t("pwa.preparingUpdate", "Preparing update...") : t("pwa.update")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={dismissForVersion}
            >
              {t("common.later")}
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label={t("common.close")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
          onClick={dismissForVersion}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
