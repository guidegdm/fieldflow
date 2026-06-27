"use client"

import { cn } from "@/lib/utils"
import { Check, RefreshCw } from "lucide-react"
import { useSync } from "@/hooks/useSync"
import { useTranslation } from "react-i18next"

export function SyncButton() {
  const { t } = useTranslation()
  const { sync, isSyncing, pendingCount } = useSync()

  return (
    <button
      onClick={sync}
      disabled={isSyncing}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-grid-line bg-white text-pencil transition-colors hover:bg-graph-paper disabled:cursor-wait disabled:opacity-100",
        isSyncing && "border-ink-blue/30 bg-ink-blue/5 text-ink-blue",
      )}
      aria-label={isSyncing ? t("sync.syncing", "Synchronisation en cours") : t("sync.syncNow")}
      aria-busy={isSyncing}
    >
      {isSyncing ? (
        <span className="relative flex h-4 w-4 items-center justify-center" aria-hidden="true">
          <span className="absolute h-4 w-4 rounded-full border-2 border-ink-blue/20" />
          <span className="absolute h-4 w-4 rounded-full border-2 border-transparent border-t-ink-blue animate-spin motion-reduce:animate-none" />
        </span>
      ) : pendingCount === 0 ? (
        <Check size={18} aria-hidden="true" />
      ) : (
        <RefreshCw size={18} aria-hidden="true" />
      )}
      {pendingCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-warning-500 rounded-full">
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      )}
    </button>
  )
}
