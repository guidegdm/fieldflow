"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { usePromptQueueSlot } from "@/lib/ui/prompt-queue"

const VERSION_KEY = "fieldflow-app-version"
const UPDATE_SNOOZE_KEY = "fieldflow-update-snooze"
const CHECK_INTERVAL_MS = 10 * 60 * 1000
const UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000

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
}

export function AppUpdateManager() {
  const { t } = useTranslation()
  const [updateReady, setUpdateReady] = useState(false)
  const checking = useRef(false)
  const { canShow, release } = usePromptQueueSlot("update", updateReady)

  useEffect(() => {
    let mounted = true

    const check = async () => {
      if (checking.current || !navigator.onLine) return
      checking.current = true
      try {
        await refreshServiceWorker()
        const latest = await fetchVersion()
        if (!latest || !mounted) return
        const current = window.localStorage.getItem(VERSION_KEY)
        if (!current) {
          window.localStorage.setItem(VERSION_KEY, latest)
          return
        }
        if (current !== latest && !isSnoozed(latest)) setUpdateReady(true)
      } finally {
        checking.current = false
      }
    }

    const onOnlineOrFocus = () => void check()
    const interval = window.setInterval(check, CHECK_INTERVAL_MS)
    window.addEventListener("online", onOnlineOrFocus)
    window.addEventListener("focus", onOnlineOrFocus)
    void check()

    return () => {
      mounted = false
      window.clearInterval(interval)
      window.removeEventListener("online", onOnlineOrFocus)
      window.removeEventListener("focus", onOnlineOrFocus)
    }
  }, [])

  if (!canShow) return null

  const reload = async () => {
    const latest = await fetchVersion()
    if (latest) window.localStorage.setItem(VERSION_KEY, latest)
    window.location.reload()
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
            <Button size="sm" onClick={reload}>{t("pwa.update")}</Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const latest = await fetchVersion()
                if (latest) window.localStorage.setItem(snoozeKey(latest), String(Date.now()))
                setUpdateReady(false)
                release()
              }}
            >
              {t("common.later")}
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label={t("common.close")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
          onClick={() => {
            setUpdateReady(false)
            release()
          }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
