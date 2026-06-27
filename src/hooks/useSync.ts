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
      const result = await retryWithBackoff(() => fullSync(), 2, 600, 2500)
      setConflicts(await db.getConflicts())
      setLastSync(Date.now())
      setPendingCount(Math.max(0, pending.length - result.acked.length))
    } catch {
      setLastSync(Date.now())
      setPendingCount((await db.getPendingMutations()).length)
    } finally {
      setSyncing(false)
    }
  }, [isSyncing, setSyncing, setPendingCount, setLastSync, setConflicts])

  return { sync, isSyncing, pendingCount }
}
