"use client"

import { useEffect, useState } from "react"
import i18n, { detectLanguage, setAppLanguage } from "@/lib/i18n/i18n"
import { I18nextProvider } from "react-i18next"
import { Toaster } from "@/components/layout/Toaster"
import { AppLoader } from "@/components/layout/AppLoader"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"
import { OfflineWarmup } from "@/components/OfflineWarmup"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [languageReady, setLanguageReady] = useState(() => {
    if (typeof window === "undefined") return false
    return i18n.language?.startsWith(detectLanguage()) ?? false
  })

  useNetworkStatus()

  useEffect(() => {
    let mounted = true
    setAppLanguage(detectLanguage()).finally(() => {
      if (mounted) setLanguageReady(true)
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <I18nextProvider i18n={i18n}>
      {languageReady ? (
        <>
          {children}
          <Toaster />
          <ServiceWorkerRegister />
          <OfflineWarmup />
        </>
      ) : (
        <AppLoader />
      )}
    </I18nextProvider>
  )
}
