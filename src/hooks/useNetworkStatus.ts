import { useEffect } from "react"
import { useSyncStore } from "@/stores/syncStore"
import { useAuthStore } from "@/stores/authStore"
import { getCurrentMode, simulateNetwork, type NetworkMode } from "@/lib/network-simulator"
import { db } from "@/lib/db/indexeddb"
import { fullSync } from "@/lib/sync/sync-client"

export function useNetworkStatus() {
  const setOnline = useSyncStore((s) => s.setOnline)
  const setSyncing = useSyncStore((s) => s.setSyncing)
  const setPendingCount = useSyncStore((s) => s.setPendingCount)
  const setLastSync = useSyncStore((s) => s.setLastSync)
  const setConflicts = useSyncStore((s) => s.setConflicts)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    let syncInFlight = false
    async function syncOnReconnect() {
      if (!user) return
      if (syncInFlight || getCurrentMode() === "offline" || !navigator.onLine) return
      syncInFlight = true
      setSyncing(true)
      try {
        const deviceState = await db.getDeviceState()
        if (!deviceState.device_id && user.deviceId) {
          await db.updateDeviceState({
            device_id: user.deviceId,
            user_id: user.id,
            orgId: user.orgId,
            workflow_id: deviceState.workflow_id || "wf-1",
            workflow_version: deviceState.workflow_version || 1,
            version: deviceState.version || 1,
          })
        }
        const pending = await db.getPendingMutations()
        setPendingCount(pending.length)
        const result = await fullSync()
        const conflicts = await db.getConflicts()
        setConflicts(conflicts.filter((conflict) => conflict.status === "OPEN"))
        setLastSync(Date.now())
        setPendingCount(Math.max(0, pending.length - result.acked.length))
      } catch {
        setPendingCount((await db.getPendingMutations()).length)
      } finally {
        setSyncing(false)
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
  }, [setConflicts, setLastSync, setOnline, setPendingCount, setSyncing, user])
}
