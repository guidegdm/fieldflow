"use client"

import i18n from "@/lib/i18n/i18n"
import { I18nextProvider } from "react-i18next"
import { Toaster } from "@/components/layout/Toaster"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      {children}
      <Toaster />
      <ServiceWorkerRegister />
    </I18nextProvider>
  )
}
