"use client"

import "@/lib/i18n/i18n"
import { Toaster } from "@/components/layout/Toaster"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
      <ServiceWorkerRegister />
    </>
  )
}
