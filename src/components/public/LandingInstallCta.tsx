"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  type BeforeInstallPromptEvent,
  markFieldFlowInstalled,
  shouldSuppressInstallUi,
} from "@/lib/pwa/install-state"

export function LandingInstallCta() {
  const { t } = useTranslation()
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    void shouldSuppressInstallUi().then(setInstalled)
    const onInstallPrompt = async (promptEvent: Event) => {
      if (await shouldSuppressInstallUi()) {
        setInstalled(true)
        return
      }
      promptEvent.preventDefault()
      setEvent(promptEvent as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      markFieldFlowInstalled()
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener("beforeinstallprompt", onInstallPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (installed || !event) return null

  const install = async () => {
    await event.prompt()
    const choice = await event.userChoice.catch(() => null)
    if (choice?.outcome === "accepted") {
      markFieldFlowInstalled()
      setInstalled(true)
      setEvent(null)
    }
  }

  return (
    <button
      type="button"
      onClick={install}
      className="inline-flex h-11 items-center gap-2 rounded-md border border-lake-deep bg-white/80 px-5 text-sm font-semibold text-lake-deep shadow-sm backdrop-blur transition-colors hover:bg-white"
    >
      <Download size={16} aria-hidden="true" />
      {t("pwa.installCta", "Install app")}
    </button>
  )
}
