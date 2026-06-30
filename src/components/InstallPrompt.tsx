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

export function InstallPrompt() {
  const { t } = useTranslation()
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return
    if (window.localStorage.getItem(DISMISSED_KEY) === "1") return

    const handleBeforeInstallPrompt = (promptEvent: Event) => {
      promptEvent.preventDefault()
      setEvent(promptEvent as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
  }, [])

  if (!visible || !event) return null

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_KEY, "1")
    setVisible(false)
  }

  const install = async () => {
    await event.prompt()
    const choice = await event.userChoice.catch(() => null)
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
