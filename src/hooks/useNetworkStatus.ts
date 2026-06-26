import { useEffect } from "react"
import { useSyncStore } from "@/stores/syncStore"
import { getCurrentMode } from "@/lib/network-simulator"

export function useNetworkStatus() {
  const setOnline = useSyncStore((s) => s.setOnline)

  useEffect(() => {
    const mode = getCurrentMode()
    if (mode === "offline") {
      setOnline(false)
    } else {
      setOnline(navigator.onLine)
    }

    const goOnline = () => {
      if (getCurrentMode() !== "offline") setOnline(true)
    }
    const goOffline = () => setOnline(false)

    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [setOnline])
}
