"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  type BeforeInstallPromptEvent,
  INSTALL_DISMISSED_KEY,
  markFieldFlowInstalled,
  markFieldFlowInstallDismissed,
  shouldSuppressInstallUi,
} from "@/lib/pwa/install-state"
import { usePromptQueueSlot } from "@/lib/ui/prompt-queue"

export function InstallPrompt() {
  const { t } = useTranslation()
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const { canShow, release } = usePromptQueueSlot("install", visible && !!event)

  useEffect(() => {
    const handleInstalled = () => {
      markFieldFlowInstalled()
      setVisible(false)
      setEvent(null)
    }

    const handleBeforeInstallPrompt = async (promptEvent: Event) => {
      if (await shouldSuppressInstallUi()) return
      if (window.localStorage.getItem(INSTALL_DISMISSED_KEY) === "1") return
      promptEvent.preventDefault()
      setEvent(promptEvent as BeforeInstallPromptEvent)
      setVisible(true)
    }

    void shouldSuppressInstallUi()
    window.addEventListener("appinstalled", handleInstalled)
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    return () => {
      window.removeEventListener("appinstalled", handleInstalled)
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  if (!canShow || !event) return null

  const dismiss = () => {
    markFieldFlowInstallDismissed()
    setVisible(false)
    release()
  }

  const install = async () => {
    await event.prompt()
    const choice = await event.userChoice.catch(() => null)
    if (choice?.outcome === "accepted") markFieldFlowInstalled()
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
