"use client"

import { db } from "@/lib/db/indexeddb"
import { LANGUAGE_STORAGE_KEY } from "@/lib/i18n/i18n"

const FIELD_FLOW_PREFIX = "fieldflow-"
const PAGE_CACHE_NAMES = new Set(["fieldflow-pages", "start-url"])

function clearStorage(storage: Storage, preserveKeys = new Set<string>()) {
  const keysToRemove: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(FIELD_FLOW_PREFIX) && !preserveKeys.has(key)) keysToRemove.push(key)
  }
  keysToRemove.forEach((key) => storage.removeItem(key))
}

async function clearIdentityCaches() {
  if (!("caches" in window)) return
  const names = await caches.keys()
  await Promise.all(names.filter((name) => PAGE_CACHE_NAMES.has(name)).map((name) => caches.delete(name)))
}

export async function clearClientSessionState() {
  if (typeof window === "undefined") return

  await db.clearAll().catch(() => {})
  clearStorage(window.localStorage, new Set([LANGUAGE_STORAGE_KEY]))
  clearStorage(window.sessionStorage)
  await clearIdentityCaches().catch(() => {})
}
