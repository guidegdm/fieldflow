"use client"

import { db } from "@/lib/db/indexeddb"
import { LANGUAGE_STORAGE_KEY } from "@/lib/i18n/i18n"

const FIELD_FLOW_PREFIX = "fieldflow-"
const PAGE_CACHE_NAMES = new Set(["fieldflow-pages", "start-url"])
const SESSION_ONLY_KEYS = new Set([
  "fieldflow-auth",
  "fieldflow-active-workflow",
  "fieldflow-pending-logout",
])

function clearStorage(storage: Storage, preserveKeys = new Set<string>()) {
  const keysToRemove: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(FIELD_FLOW_PREFIX) && !preserveKeys.has(key) && SESSION_ONLY_KEYS.has(key)) keysToRemove.push(key)
  }
  keysToRemove.forEach((key) => storage.removeItem(key))
}

async function purgePoisonedPageResponses() {
  if (!("caches" in window)) return
  await Promise.all(Array.from(PAGE_CACHE_NAMES).map(async (name) => {
    const cache = await caches.open(name).catch(() => null)
    if (!cache) return
    const requests = await cache.keys()
    await Promise.all(requests.map(async (request) => {
      const url = new URL(request.url)
      if (url.searchParams.has("_rsc") || request.headers.get("rsc") === "1") {
        await cache.delete(request)
        return
      }
      const response = await cache.match(request)
      const contentType = response?.headers.get("content-type") || ""
      if (response && !contentType.includes("text/html")) await cache.delete(request)
    }))
  }))
}

export async function clearClientSessionState() {
  if (typeof window === "undefined") return

  await db.clearAll().catch(() => {})
  clearStorage(window.localStorage, new Set([LANGUAGE_STORAGE_KEY]))
  clearStorage(window.sessionStorage)
  await purgePoisonedPageResponses().catch(() => {})
}
