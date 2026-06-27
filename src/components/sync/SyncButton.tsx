"use client"

import { cn } from "@/lib/utils"
import { RefreshCw } from "lucide-react"
import { useSync } from "@/hooks/useSync"

export function SyncButton() {
  const { sync, isSyncing, pendingCount } = useSync()

  return (
    <button
      onClick={sync}
      disabled={isSyncing}
      className="relative inline-flex items-center justify-center w-10 h-10 rounded-lg border border-grid-line bg-white hover:bg-graph-paper disabled:opacity-50 transition-colors"
      aria-label="Synchroniser"
    >
      <RefreshCw size={18} className={cn("text-pencil", isSyncing && "animate-spin")} />
      {pendingCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-warning-500 rounded-full">
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      )}
    </button>
  )
}
