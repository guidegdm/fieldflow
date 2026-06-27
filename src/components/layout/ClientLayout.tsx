"use client"

import { useEffect } from "react"
import i18n, { detectLanguage, setAppLanguage } from "@/lib/i18n/i18n"
import { I18nextProvider } from "react-i18next"
import { Toaster } from "@/components/layout/Toaster"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  useNetworkStatus()

  useEffect(() => {
    void setAppLanguage(detectLanguage())
  }, [])

  return (
    <I18nextProvider i18n={i18n}>
      {children}
      <Toaster />
      <ServiceWorkerRegister />
    </I18nextProvider>
  )
}
