"use client"

import { useEffect, useState } from "react"
import i18n, { detectLanguage, LANGUAGE_CHANGED_EVENT, preloadAppLanguages, setAppLanguage, type AppLanguage } from "@/lib/i18n/i18n"
import { I18nextProvider } from "react-i18next"
import { Toaster } from "@/components/layout/Toaster"
import { AppLoader } from "@/components/layout/AppLoader"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"
import { OfflineWarmup } from "@/components/OfflineWarmup"
import { InstallPrompt } from "@/components/InstallPrompt"
import { AppUpdateManager } from "@/components/AppUpdateManager"
import { PasskeyPrompt } from "@/components/PasskeyPrompt"
import { WorkspaceSyncManager } from "@/components/WorkspaceSyncManager"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"
import { useAuthStore } from "@/stores/authStore"
import { useWorkflowListStore } from "@/stores/workflowListStore"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const authHydrated = useAuthStore((state) => state.hasHydrated)
  const orgId = useAuthStore((state) => state.user?.orgId)
  const loadWorkflowsForOrg = useWorkflowListStore((state) => state.loadForOrg)
  const [language, setLanguage] = useState<AppLanguage>(() => (typeof window === "undefined" ? "fr" : detectLanguage()))
  const [languageReady, setLanguageReady] = useState(() => {
    if (typeof window === "undefined") return false
    return i18n.language?.startsWith(detectLanguage()) ?? false
  })

  useNetworkStatus()

  useEffect(() => {
    let mounted = true
    const initialLanguage = detectLanguage()
    Promise.all([preloadAppLanguages(), setAppLanguage(initialLanguage)]).finally(() => {
      if (mounted) setLanguage(initialLanguage)
      if (mounted) setLanguageReady(true)
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const syncLanguage = (event: Event) => {
      const next = (event as CustomEvent<{ language?: AppLanguage }>).detail?.language ?? detectLanguage()
      setLanguage(next)
      document.documentElement.lang = next
    }
    window.addEventListener(LANGUAGE_CHANGED_EVENT, syncLanguage)
    return () => window.removeEventListener(LANGUAGE_CHANGED_EVENT, syncLanguage)
  }, [])

  useEffect(() => {
    if (!languageReady || !authHydrated || !orgId) return
    void loadWorkflowsForOrg(orgId).catch(() => {})
  }, [authHydrated, languageReady, loadWorkflowsForOrg, orgId])

  return (
    <I18nextProvider i18n={i18n}>
      {languageReady ? (
        <>
          <div key={language} className="contents">
            {children}
          </div>
          <Toaster />
          <ServiceWorkerRegister />
          <OfflineWarmup />
          <InstallPrompt />
          <AppUpdateManager />
          <PasskeyPrompt />
          <WorkspaceSyncManager />
        </>
      ) : (
        <AppLoader />
      )}
    </I18nextProvider>
  )
}
