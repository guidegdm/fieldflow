"use client"

const FIELD_FLOW_SYNC_TAG = "fieldflow-sync"

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> }
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
