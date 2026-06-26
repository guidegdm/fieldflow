import { useCallback } from "react"
import { db } from "@/lib/db/indexeddb"
import { fullSync } from "@/lib/sync/sync-client"
import { useSyncStore } from "@/stores/syncStore"
import { retryWithBackoff } from "@/lib/sync/backoff"

export function useSync() {
  const { isSyncing, pendingCount, setSyncing, setPendingCount, setLastSync, setConflicts } = useSyncStore()

  const sync = useCallback(async () => {
    if (isSyncing) return
    setSyncing(true)
    try {
      const pending = await db.getPendingMutations()
      setPendingCount(pending.length)
      const result = await retryWithBackoff(() => fullSync())
      setConflicts((result as any)?.conflicts ?? [])
      setLastSync(Date.now())
      setPendingCount((result as any)?.acked ? Math.max(0, pending.length - (result as any).acked.length) : 0)
    } catch {
      setLastSync(Date.now())
    } finally {
      setSyncing(false)
    }
  }, [isSyncing, setSyncing, setPendingCount, setLastSync, setConflicts])

  return { sync, isSyncing, pendingCount }
}
