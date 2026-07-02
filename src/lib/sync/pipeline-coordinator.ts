"use client"

import { runBackgroundSync } from "@/lib/sync/run-background-sync"
import type { DemoUser } from "@/types/auth"

const LOCK_KEY = "fieldflow-sync-pipeline-lock"
const OWNER_KEY = "fieldflow-sync-pipeline-owner"
const LOCK_TTL_MS = 45_000

type SyncRequestOptions = {
  reason?: string
  retry?: boolean
}

type LockValue = {
  owner: string
  expiresAt: number
  reason?: string
}

let activePipeline: Promise<unknown> | null = null
let queued = false
let latestUser: DemoUser | null | undefined = null
let latestOptions: SyncRequestOptions = {}
let channel: BroadcastChannel | null = null

function ownerId() {
  if (typeof window === "undefined") return "server"
  let owner = window.sessionStorage.getItem(OWNER_KEY)
  if (!owner) {
    owner = crypto.randomUUID()
    window.sessionStorage.setItem(OWNER_KEY, owner)
  }
  return owner
}

function readLock(): LockValue | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(LOCK_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as LockValue
    if (!parsed.owner || !Number.isFinite(parsed.expiresAt)) return null
    return parsed
  } catch {
    return null
  }
}

function acquireLock(reason?: string) {
  if (typeof window === "undefined") return true
  const now = Date.now()
  const current = readLock()
  if (current && current.owner !== ownerId() && current.expiresAt > now) return false

  const next = { owner: ownerId(), expiresAt: now + LOCK_TTL_MS, reason }
  window.localStorage.setItem(LOCK_KEY, JSON.stringify(next))
  return readLock()?.owner === next.owner
}

function refreshLock(reason?: string) {
  if (typeof window === "undefined") return
  const current = readLock()
  if (current?.owner !== ownerId()) return
  window.localStorage.setItem(LOCK_KEY, JSON.stringify({ owner: ownerId(), expiresAt: Date.now() + LOCK_TTL_MS, reason }))
}

function releaseLock() {
  if (typeof window === "undefined") return
  const current = readLock()
  if (current?.owner === ownerId()) window.localStorage.removeItem(LOCK_KEY)
}

function syncChannel() {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null
  channel ||= new BroadcastChannel("fieldflow-sync-pipeline")
  return channel
}

function broadcast(type: "started" | "finished", detail?: Record<string, unknown>) {
  syncChannel()?.postMessage({ type, owner: ownerId(), at: Date.now(), ...detail })
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(`fieldflow:sync-pipeline-${type}`, { detail }))
}

async function drainPipeline() {
  while (queued) {
    queued = false
    const user = latestUser
    const options = latestOptions

    if (!acquireLock(options.reason)) {
      return null
    }

    const keepAlive = typeof window !== "undefined"
      ? window.setInterval(() => refreshLock(options.reason), Math.floor(LOCK_TTL_MS / 3))
      : null
    try {
      broadcast("started", { reason: options.reason })
      await runBackgroundSync(user, { retry: options.retry ?? true })
      broadcast("finished", { reason: options.reason, ok: true })
    } catch (error) {
      broadcast("finished", { reason: options.reason, ok: false, error: error instanceof Error ? error.message : "sync_failed" })
      throw error
    } finally {
      if (keepAlive) window.clearInterval(keepAlive)
      releaseLock()
    }
  }
  return null
}

export function requestPipelineSync(user?: DemoUser | null, options: SyncRequestOptions = {}) {
  latestUser = user
  latestOptions = { retry: true, ...latestOptions, ...options }
  queued = true
  if (!activePipeline) {
    activePipeline = drainPipeline().finally(() => {
      activePipeline = null
      if (queued) void requestPipelineSync(latestUser, latestOptions)
    })
  }
  return activePipeline
}
