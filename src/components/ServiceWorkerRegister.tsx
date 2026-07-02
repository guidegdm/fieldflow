"use client"

import { useEffect } from "react"
import { requestPipelineSync } from "@/lib/sync/pipeline-coordinator"
import { registerFieldFlowPeriodicMaintenance } from "@/lib/sync/register-background-sync"
import { useAuthStore } from "@/stores/authStore"
import { flushPendingLogout } from "@/lib/auth/client-logout"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return

    const CONTROL_RELOAD_KEY = "fieldflow-sw-control-reload"
    const hadControllerAtStart = Boolean(navigator.serviceWorker.controller)
    let refreshing = false
    let registrationRef: ServiceWorkerRegistration | null = null
    const handleControllerChange = () => {
      if (refreshing) return
      if (hadControllerAtStart) {
        window.dispatchEvent(new CustomEvent("fieldflow:service-worker-updated"))
        return
      }
      refreshing = true
      window.sessionStorage.removeItem(CONTROL_RELOAD_KEY)
      window.location.reload()
    }
    const handleOnline = () => {
      if (registrationRef) void registrationRef.update()
      void flushPendingLogout()
    }
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "FIELD_FLOW_SYNC_NOW") return
      const user = useAuthStore.getState().user
      if (!user) return
      void requestPipelineSync(user, { reason: "service-worker", retry: true })
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)
    navigator.serviceWorker.addEventListener("message", handleMessage)

    navigator.serviceWorker.register("/sw.js")
      .then((registration) => {
        registrationRef = registration
        if (navigator.onLine) void registration.update().catch(() => {})
        if (navigator.onLine) void flushPendingLogout()
        void registerFieldFlowPeriodicMaintenance()
        void navigator.serviceWorker.ready.then(() => {
          if (navigator.serviceWorker.controller) return
          if (window.sessionStorage.getItem(CONTROL_RELOAD_KEY)) return
          window.sessionStorage.setItem(CONTROL_RELOAD_KEY, "1")
          window.location.reload()
        }).catch(() => {})
        window.addEventListener("online", handleOnline)
      })
      .catch(() => {})

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
      navigator.serviceWorker.removeEventListener("message", handleMessage)
      window.removeEventListener("online", handleOnline)
    }
  }, [])
  return null
}
