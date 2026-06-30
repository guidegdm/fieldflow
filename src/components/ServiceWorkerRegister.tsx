"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return

    const CONTROL_RELOAD_KEY = "fieldflow-sw-control-reload"
    let refreshing = false
    let registrationRef: ServiceWorkerRegistration | null = null
    const handleControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.sessionStorage.removeItem(CONTROL_RELOAD_KEY)
      window.location.reload()
    }
    const handleOnline = () => {
      if (registrationRef) void registrationRef.update()
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)

    navigator.serviceWorker.register("/sw.js")
      .then((registration) => {
        registrationRef = registration
        if (navigator.onLine) void registration.update().catch(() => {})
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
      window.removeEventListener("online", handleOnline)
    }
  }, [])
  return null
}
