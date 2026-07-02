import { useEffect } from "react"
import { useSyncStore } from "@/stores/syncStore"
import { useAuthStore } from "@/stores/authStore"
import { getCurrentMode, simulateNetwork, type NetworkMode } from "@/lib/network-simulator"
import { requestPipelineSync } from "@/lib/sync/pipeline-coordinator"

export function useNetworkStatus() {
  const setOnline = useSyncStore((s) => s.setOnline)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    let syncInFlight = false
    async function syncOnReconnect() {
      if (!user) return
      if (syncInFlight || getCurrentMode() === "offline" || !navigator.onLine) return
      syncInFlight = true
      try {
        await requestPipelineSync(user, { reason: "network-reconnect", retry: true })
      } finally {
        syncInFlight = false
      }
    }

    const mode = getCurrentMode()
    if (mode !== "online") simulateNetwork(mode)
    if (mode === "offline") {
      setOnline(false)
    } else {
      setOnline(navigator.onLine)
      if (navigator.onLine) void syncOnReconnect()
    }

    const goOnline = () => {
      if (getCurrentMode() !== "offline") {
        setOnline(true)
        void syncOnReconnect()
      }
    }
    const goOffline = () => setOnline(false)
    const applyRequestedMode = (mode: NetworkMode) => {
      if (!["online", "offline", "slow3g", "flaky"].includes(mode)) return
      simulateNetwork(mode)
      setOnline(mode !== "offline" && navigator.onLine)
      if (mode !== "offline" && navigator.onLine) void syncOnReconnect()
    }
    const handleRequestedMode = (event: Event) => {
      applyRequestedMode((event as CustomEvent<NetworkMode>).detail)
    }
    const browserWindow = window as Window & {
      __fieldflowSetNetworkMode?: (mode: NetworkMode) => void
    }
    browserWindow.__fieldflowSetNetworkMode = applyRequestedMode

    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    window.addEventListener("fieldflow:set-network-mode", handleRequestedMode)
    const interval = window.setInterval(() => {
      const mode = getCurrentMode()
      setOnline(mode !== "offline" && navigator.onLine)
    }, 1000)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
      window.removeEventListener("fieldflow:set-network-mode", handleRequestedMode)
      if (browserWindow.__fieldflowSetNetworkMode === applyRequestedMode) {
        delete browserWindow.__fieldflowSetNetworkMode
      }
      window.clearInterval(interval)
    }
  }, [setOnline, user])
}
