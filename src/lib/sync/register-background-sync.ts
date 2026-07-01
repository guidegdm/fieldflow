"use client"

const FIELD_FLOW_SYNC_TAG = "fieldflow-sync"
const FIELD_FLOW_MAINTENANCE_TAG = "fieldflow-maintenance"
const PERIODIC_MAINTENANCE_INTERVAL_MS = 6 * 60 * 60 * 1000

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> }
  periodicSync?: {
    register: (tag: string, options?: { minInterval?: number }) => Promise<void>
  }
}

export async function registerFieldFlowBackgroundSync() {
  if (typeof navigator === "undefined") return false
  if (!("serviceWorker" in navigator)) return false

  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const sync = (registration as SyncCapableRegistration | null)?.sync
  if (!sync?.register) return false

  try {
    await sync.register(FIELD_FLOW_SYNC_TAG)
    return true
  } catch {
    return false
  }
}

export async function registerFieldFlowPeriodicMaintenance() {
  if (typeof navigator === "undefined") return false
  if (!("serviceWorker" in navigator)) return false

  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const periodicSync = (registration as SyncCapableRegistration | null)?.periodicSync
  if (!periodicSync?.register) return false

  try {
    await periodicSync.register(FIELD_FLOW_MAINTENANCE_TAG, {
      minInterval: PERIODIC_MAINTENANCE_INTERVAL_MS,
    })
    return true
  } catch {
    return false
  }
}
