import { db } from "@/lib/db/indexeddb"
import { getCurrentMode } from "@/lib/network-simulator"
import { retryWithBackoff } from "@/lib/sync/backoff"
import { fullSync } from "@/lib/sync/sync-client"
import { useSyncStore } from "@/stores/syncStore"
import { syncPendingAttachments } from "@/lib/attachments/sync-pending"
import { invalidate } from "@/lib/invalidation"
import type { DemoUser } from "@/types/auth"

let activeSync: Promise<unknown> | null = null

export async function runBackgroundSync(user?: DemoUser | null, options: { retry?: boolean } = {}) {
  if (typeof navigator !== "undefined" && (!navigator.onLine || getCurrentMode() === "offline")) {
    useSyncStore.getState().setPendingCount((await db.getPendingMutations()).length)
    return null
  }

  if (activeSync) {
    await activeSync.catch(() => null)
    if ((await db.getPendingMutations()).length === 0) return null
  }

  if (useSyncStore.getState().isSyncing) return null

  activeSync = performSync(user, options).finally(() => {
    activeSync = null
  })
  return activeSync
}

async function performSync(user?: DemoUser | null, options: { retry?: boolean } = {}) {
  const syncStore = useSyncStore.getState()
  syncStore.setSyncing(true)
  syncStore.setSyncAttempt(Date.now())
  syncStore.setSyncError(null)
  try {
    await syncPendingAttachments(user)
    const pendingMutations = await db.getPendingMutations()
    if (user?.deviceId) {
      const deviceState = await db.getDeviceState()
      if (!deviceState.device_id) {
        await db.updateDeviceState({
          device_id: user.deviceId,
          user_id: user.id,
          orgId: user.orgId,
          workflow_id: deviceState.workflow_id || pendingMutations[0]?.workflow_id || "",
          workflow_version: deviceState.workflow_version || 1,
          version: deviceState.version || 1,
        })
      }
    }

    syncStore.setPendingCount(pendingMutations.length)
    const result = options.retry
      ? await retryWithBackoff(() => fullSync(), 2, 600, 2500)
      : await fullSync()
    const conflicts = await db.getConflicts(user?.orgId)
    syncStore.setConflicts(conflicts.filter((conflict) => conflict.status === "OPEN"))
    syncStore.setSyncSuccess(Date.now())
    syncStore.setPendingCount((await db.getPendingMutations()).length)
    invalidate(["sync", "records", "review", "conflicts", "workflows"])
    return result
  } catch (error) {
    syncStore.setSyncError(error instanceof Error ? error.message : "Sync failed")
    syncStore.setPendingCount((await db.getPendingMutations()).length)
    return null
  } finally {
    useSyncStore.getState().setSyncing(false)
  }
}
