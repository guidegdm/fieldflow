"use client"

import { useState, useEffect, useCallback } from "react"
import { useSyncStore } from "@/stores/syncStore"
import { useStorageQuota } from "@/hooks/useStorageQuota"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
  const { isOnline, isSyncing, pendingCount, lastSyncAt, setOnline } =
    useSyncStore()
  const { usage, quota, percentageUsed, isNearLimit } = useStorageQuota()
  const [showSim, setShowSim] = useState(false)
  const [simMode, setSimMode] = useState<NetworkMode>(getCurrentMode())

  const failed = pendingCount > 0 && !isSyncing
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

  useEffect(() => {
    function handleRequestedMode(event: Event) {
      const mode = (event as CustomEvent<NetworkMode>).detail
      if (!modes.some((candidate) => candidate.value === mode)) return
      handleMode(mode)
    }

    window.addEventListener("fieldflow:set-network-mode", handleRequestedMode)
    return () => window.removeEventListener("fieldflow:set-network-mode", handleRequestedMode)
  }, [handleMode])

  let status: { text: string; className: string }

  if (isSyncing) {
    status = {
      text: t("common.syncing"),
      className: "bg-ink-blue/5 text-ink-blue",
    }
  } else if (!isOnline) {
    status = {
      text: t("common.offline"),
      className: "bg-graph-paper text-pencil",
    }
  } else if (failed) {
    status = {
      text: t("common.pendingSync"),
      className: "bg-amber-50 text-warning-600",
    }
  } else {
    status = {
      text: t("common.online"),
      className: "bg-green-50 text-success-500",
    }
  }

  return (
    <div className="relative z-50">
      <div
        className={cn(
          "h-7 flex items-center justify-center text-xs font-medium",
          status.className,
        )}
      >
        <span className="flex flex-1 items-center justify-center gap-2 text-center">
          <span className={cn("h-1.5 w-1.5 rounded-full", isSyncing ? "bg-ink-blue" : isOnline ? "bg-success-500" : "bg-pencil")} />
          {status.text}
        </span>
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
        <div className="h-1 bg-graph-line">
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
