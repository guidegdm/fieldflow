"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const DISMISSED_KEY = "fieldflow-install-dismissed"
const LAST_NOTICE_KEY = "fieldflow-install-notice-date"
const NOTICE_DELAY_MS = 90_000
const INSTALLED_KEY = "fieldflow-installed"

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function isMarkedInstalled() {
  return isStandalone() || window.localStorage.getItem(INSTALLED_KEY) === "1"
}

export function InstallPrompt() {
  const { t } = useTranslation()
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isMarkedInstalled()) return
    if (window.localStorage.getItem(DISMISSED_KEY) === "1") return

    const handleInstalled = () => {
      window.localStorage.setItem(INSTALLED_KEY, "1")
      setVisible(false)
      setEvent(null)
    }

    const handleBeforeInstallPrompt = (promptEvent: Event) => {
      if (isMarkedInstalled()) return
      promptEvent.preventDefault()
      setEvent(promptEvent as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener("appinstalled", handleInstalled)
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    return () => {
      window.removeEventListener("appinstalled", handleInstalled)
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  useEffect(() => {
    if (!visible || !event) return
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return
    if (isMarkedInstalled()) return
    if (window.localStorage.getItem(DISMISSED_KEY) === "1") return
    if (window.localStorage.getItem(LAST_NOTICE_KEY) === todayKey()) return
    if (Notification.permission === "denied") return

    const timer = window.setTimeout(async () => {
      if (document.visibilityState !== "visible") return
      if (isMarkedInstalled()) return
      if (window.localStorage.getItem(DISMISSED_KEY) === "1") return
      if (window.localStorage.getItem(LAST_NOTICE_KEY) === todayKey()) return

      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission().catch(() => "default")
      if (permission !== "granted") {
        window.localStorage.setItem(LAST_NOTICE_KEY, todayKey())
        return
      }

      const registration = await navigator.serviceWorker.ready.catch(() => null)
      await registration?.showNotification(t("pwa.installTitle"), {
        body: t("pwa.installBody"),
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "fieldflow-install",
      })
      window.localStorage.setItem(LAST_NOTICE_KEY, todayKey())
    }, NOTICE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [event, t, visible])

  if (!visible || !event) return null

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, "1")
    window.localStorage.setItem(LAST_NOTICE_KEY, todayKey())
    setVisible(false)
  }

  const install = async () => {
    await event.prompt()
    const choice = await event.userChoice.catch(() => null)
    if (choice?.outcome === "accepted") window.localStorage.setItem(INSTALLED_KEY, "1")
    if (!choice || choice.outcome !== "dismissed") dismiss()
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-graph-line bg-white/95 p-3 shadow-xl backdrop-blur sm:bottom-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-blue text-white">
          <Download className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink-black">{t("pwa.installTitle")}</p>
          <p className="mt-1 text-sm leading-5 text-pencil">{t("pwa.installBody")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={install}>{t("pwa.install")}</Button>
            <Button size="sm" variant="secondary" onClick={dismiss}>{t("common.cancel")}</Button>
          </div>
        </div>
        <button
          type="button"
          aria-label={t("common.close")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
          onClick={dismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
