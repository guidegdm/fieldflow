"use client"

import { useEffect, useState } from "react"
import i18n, { detectLanguage, preloadAppLanguages, setAppLanguage } from "@/lib/i18n/i18n"
import { I18nextProvider } from "react-i18next"
import { Toaster } from "@/components/layout/Toaster"
import { AppLoader } from "@/components/layout/AppLoader"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"
import { OfflineWarmup } from "@/components/OfflineWarmup"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"
import { useAuthStore } from "@/stores/authStore"
import { useWorkflowListStore } from "@/stores/workflowListStore"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const authHydrated = useAuthStore((state) => state.hasHydrated)
  const orgId = useAuthStore((state) => state.user?.orgId)
  const loadWorkflowsForOrg = useWorkflowListStore((state) => state.loadForOrg)
  const [languageReady, setLanguageReady] = useState(() => {
    if (typeof window === "undefined") return false
    return i18n.language?.startsWith(detectLanguage()) ?? false
  })

  useNetworkStatus()

  useEffect(() => {
    let mounted = true
    Promise.all([preloadAppLanguages(), setAppLanguage(detectLanguage())]).finally(() => {
      if (mounted) setLanguageReady(true)
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!languageReady || !authHydrated || !orgId) return
    void loadWorkflowsForOrg(orgId).catch(() => {})
  }, [authHydrated, languageReady, loadWorkflowsForOrg, orgId])

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
