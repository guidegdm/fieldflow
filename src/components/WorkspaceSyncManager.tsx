"use client"

import { useEffect, useRef } from "react"
import { useAuthStore } from "@/stores/authStore"

export function WorkspaceSyncManager() {
  const org = useAuthStore((state) => state.org)
  const markWorkspaceSynced = useAuthStore((state) => state.markWorkspaceSynced)
  const syncing = useRef<string | null>(null)

  useEffect(() => {
    if (!org?.localOnly || !navigator.onLine || syncing.current === org.id) return
    syncing.current = org.id

    fetch("/api/auth/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        clientOrgId: org.id,
        name: org.name,
        sector: org.sector || "other",
      }),
    })
      .then(async (response) => {
        if (!response.ok) return
        const data = await response.json()
        if (data.org?.id === org.id) markWorkspaceSynced(data.org)
      })
      .catch(() => {})
      .finally(() => {
        syncing.current = null
      })
  }, [markWorkspaceSynced, org?.id, org?.localOnly, org?.name, org?.sector])

  return null
}
