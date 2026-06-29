import { useCallback } from "react"
import { runBackgroundSync } from "@/lib/sync/run-background-sync"
import { useSyncStore } from "@/stores/syncStore"
import { useAuthStore } from "@/stores/authStore"

export function useSync() {
  const { isSyncing, pendingCount } = useSyncStore()
  const user = useAuthStore((state) => state.user)

  const sync = useCallback(async () => {
    if (isSyncing) return
    await runBackgroundSync(user, { retry: true })
  }, [isSyncing, user])

  return { sync, isSyncing, pendingCount }
}
