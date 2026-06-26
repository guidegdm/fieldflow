"use client"

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
