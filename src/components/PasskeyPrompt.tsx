"use client"

import { useEffect, useState } from "react"
import { KeyRound, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/authStore"
import { createPasskeyCredential, supportsPasskeys } from "@/lib/auth/webauthn-client"
import { usePromptQueueSlot } from "@/lib/ui/prompt-queue"

const DISMISSED_KEY = "fieldflow-passkey-dismissed"
const REGISTERED_KEY = "fieldflow-passkey-registered"
const PROMPT_DELAY_MS = 75_000
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000

function userKey(prefix: string, email?: string) {
  return email ? `${prefix}:${email.toLowerCase()}` : prefix
}

function recentlyDismissed(email?: string) {
  const value = Number(window.localStorage.getItem(userKey(DISMISSED_KEY, email)) || 0)
  return Number.isFinite(value) && Date.now() - value < DISMISS_MS
}

function markDismissed(email?: string) {
  window.localStorage.setItem(userKey(DISMISSED_KEY, email), String(Date.now()))
}

function markRegistered(email?: string) {
  window.localStorage.setItem(userKey(REGISTERED_KEY, email), "1")
}

export function PasskeyPrompt() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const authHydrated = useAuthStore((state) => state.hasHydrated)
  const [requested, setRequested] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [error, setError] = useState("")
  const { canShow, release } = usePromptQueueSlot("passkey", requested)

  useEffect(() => {
    if (!authHydrated || !user?.email || user.email.endsWith("@demo.ff") || !navigator.onLine || !supportsPasskeys()) return
    if (window.localStorage.getItem(userKey(REGISTERED_KEY, user.email)) === "1" || recentlyDismissed(user.email)) return

    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/auth/passkey", { credentials: "include", cache: "no-store" })
        if (!response.ok || cancelled) return
        const data = await response.json() as { available?: boolean; registered?: boolean }
        if (data.registered) {
          markRegistered(user.email)
          return
        }
        if (data.available !== false) setRequested(true)
      } catch {}
    }, PROMPT_DELAY_MS)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [authHydrated, user?.email])

  if (!canShow || !user?.email) return null

  const dismiss = () => {
    markDismissed(user.email)
    setRequested(false)
    release()
  }

  const register = async () => {
    setRegistering(true)
    setError("")
    try {
      const start = await fetch("/api/auth/passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "start" }),
      })
      if (!start.ok) throw new Error("start_failed")
      const { options } = await start.json()
      const credential = await createPasskeyCredential(options)
      const complete = await fetch("/api/auth/passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "complete", credential }),
      })
      if (!complete.ok) throw new Error("complete_failed")
      markRegistered(user.email)
      setRequested(false)
      release()
    } catch {
      setError(t("passkey.error", "Passkey could not be registered on this device."))
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="fixed inset-x-3 top-[calc(4.75rem+env(safe-area-inset-top))] z-50 mx-auto max-h-[min(24rem,calc(100dvh-2rem))] max-w-md overflow-y-auto rounded-2xl border border-graph-line bg-white/95 p-3 shadow-2xl shadow-ink-black/10 ring-1 ring-ink-black/5 backdrop-blur sm:bottom-5 sm:left-auto sm:right-5 sm:top-auto sm:mx-0 sm:max-w-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-blue text-white shadow-sm">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink-black">{t("passkey.title", "Add a passkey")}</p>
          <p className="mt-1 text-sm leading-5 text-pencil">
            {t("passkey.body", "Use this device to sign in faster next time. Your fingerprint, face, or device PIN never leaves the device.")}
          </p>
          {error && <p className="mt-2 text-xs text-danger-500">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" loading={registering} onClick={register}>{t("passkey.register", "Add passkey")}</Button>
            <Button size="sm" variant="secondary" onClick={dismiss} disabled={registering}>{t("common.later", "Later")}</Button>
          </div>
        </div>
        <button
          type="button"
          aria-label={t("common.close")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
          onClick={dismiss}
          disabled={registering}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
