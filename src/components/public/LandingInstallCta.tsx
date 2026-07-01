"use client"

import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import { useTranslation } from "react-i18next"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

const INSTALLED_KEY = "fieldflow-installed"

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function LandingInstallCta() {
  const { t } = useTranslation()
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setInstalled(isStandalone() || window.localStorage.getItem(INSTALLED_KEY) === "1")
    const onInstallPrompt = (promptEvent: Event) => {
      if (isStandalone() || window.localStorage.getItem(INSTALLED_KEY) === "1") return
      promptEvent.preventDefault()
      setEvent(promptEvent as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      window.localStorage.setItem(INSTALLED_KEY, "1")
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
      window.localStorage.setItem(INSTALLED_KEY, "1")
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
