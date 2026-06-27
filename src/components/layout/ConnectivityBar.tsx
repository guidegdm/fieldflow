"use client"

import { useState, useEffect, useCallback } from "react"
import { useSyncStore } from "@/stores/syncStore"
import { useStorageQuota } from "@/hooks/useStorageQuota"
import { cn } from "@/lib/utils"
import {
  simulateNetwork,
  getCurrentMode,
  type NetworkMode,
} from "@/lib/network-simulator"

const modes: { value: NetworkMode; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "slow3g", label: "Slow 3G" },
  { value: "flaky", label: "Flaky" },
]

export function ConnectivityBar() {
  const { isOnline, isSyncing, pendingCount, lastSyncAt, setOnline } =
    useSyncStore()
  const { usage, quota, percentageUsed, isNearLimit } = useStorageQuota()
  const [showSim, setShowSim] = useState(false)
  const [simMode, setSimMode] = useState<NetworkMode>(getCurrentMode())

  const failed = pendingCount > 0 && !isSyncing && lastSyncAt !== null
  const showStorage = quota > 0 && percentageUsed > 70

  const isDev = process.env.NODE_ENV === "development"

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "n") {
        setShowSim((v) => !v)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const handleMode = useCallback(
    (mode: NetworkMode) => {
      setSimMode(mode)
      simulateNetwork(mode)
      setOnline(mode !== "offline")
    },
    [setOnline],
  )

  let status: { text: string; className: string }

  if (isSyncing) {
    status = {
      text: "◉ Synchronisation...",
      className: "bg-blue-50 text-ink-blue",
    }
  } else if (!isOnline) {
    status = {
      text: "● Hors ligne",
      className: "bg-gray-100 text-pencil",
    }
  } else if (failed) {
    status = {
      text: "⚠ Sync en attente",
      className: "bg-amber-50 text-warning-600",
    }
  } else {
    status = {
      text: "● En ligne",
      className: "bg-green-50 text-success-500",
    }
  }

  return (
    <div className="relative z-50">
      <div
        className={cn(
          "h-7 flex items-center justify-center text-xs font-medium",
          status.className,
          isSyncing && "animate-sync-pulse",
        )}
      >
        <span className="flex-1 text-center">{status.text}</span>
        {isDev && (
          <button
            type="button"
            onClick={() => setShowSim((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs leading-none p-0.5 rounded hover:bg-black/5 transition-colors"
            title="Network simulator (Ctrl+Shift+N)"
            aria-label="Toggle network simulator"
          >
            {simMode === "online" ? "⚡" : "⚠"}
          </button>
        )}
      </div>

      {showStorage && (
        <div className="h-1 bg-gray-200">
          <div
            className={cn("h-full transition-all", isNearLimit ? "bg-warning-500" : "bg-warning-500")}
            style={{ width: `${Math.min(percentageUsed, 100)}%` }}
          />
        </div>
      )}

      {isDev && showSim && (
        <div className="absolute top-full left-0 right-0 bg-white border border-graph-line shadow-md px-3 py-2 flex items-center gap-3 text-xs">
          <span className="text-pencil font-medium whitespace-nowrap">
            Réseau
          </span>
          {modes.map((m) => (
            <label
              key={m.value}
              className="flex items-center gap-1 cursor-pointer text-ink-black hover:text-ink-blue transition-colors"
            >
              <input
                type="radio"
                name="network-mode"
                value={m.value}
                checked={simMode === m.value}
                onChange={() => handleMode(m.value)}
                className="accent-ink-blue"
              />
              {m.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
