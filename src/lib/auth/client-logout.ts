"use client"

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { clearClientSessionState } from "@/lib/auth/client-session-cleanup"

const PENDING_LOGOUT_KEY = "fieldflow-pending-logout"

async function callLogoutEndpoint() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  })
  if (!response.ok) throw new Error("logout_failed")
}

export async function flushPendingLogout() {
  if (typeof window === "undefined") return
  if (!navigator.onLine) return
  if (!window.localStorage.getItem(PENDING_LOGOUT_KEY)) return

  try {
    await callLogoutEndpoint()
    window.localStorage.removeItem(PENDING_LOGOUT_KEY)
  } catch {
    window.localStorage.setItem(PENDING_LOGOUT_KEY, String(Date.now()))
  }
}

export async function completeClientLogout(logout: () => void, router?: AppRouterInstance) {
  if (typeof window === "undefined") return

  await clearClientSessionState()
  logout()
  router?.push("/")

  try {
    if (!navigator.onLine) throw new Error("offline")
    await callLogoutEndpoint()
    window.localStorage.removeItem(PENDING_LOGOUT_KEY)
  } catch {
    window.localStorage.setItem(PENDING_LOGOUT_KEY, String(Date.now()))
  }
}
