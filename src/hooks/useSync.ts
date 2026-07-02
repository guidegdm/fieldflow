import { useCallback } from "react"
import { requestPipelineSync } from "@/lib/sync/pipeline-coordinator"
import { useSyncStore } from "@/stores/syncStore"
import { useAuthStore } from "@/stores/authStore"

export function useSync() {
  const { isSyncing, pendingCount } = useSyncStore()
  const user = useAuthStore((state) => state.user)

  const sync = useCallback(async () => {
    if (isSyncing) return
    await requestPipelineSync(user, { reason: "manual", retry: true })
  }, [isSyncing, user])

  return { sync, isSyncing, pendingCount }
}
