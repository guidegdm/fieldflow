"use client"

import { cn } from "@/lib/utils"
import type { SyncStatus } from "@/types/record"
import { useTranslation } from "react-i18next"

const statusConfig: Record<SyncStatus, { labelKey: string; fallback: string; color: string; dot: string }> = {
  local: { labelKey: "status.local", fallback: "Local", color: "text-pencil", dot: "bg-pencil" },
  pending: { labelKey: "status.pending", fallback: "Pending", color: "text-warning-500", dot: "bg-warning-500" },
  synced: { labelKey: "status.synced", fallback: "Synced", color: "text-success-500", dot: "bg-success-500" },
  conflict: { labelKey: "status.conflict", fallback: "Conflict", color: "text-warning-500", dot: "bg-warning-500" },
  failed: { labelKey: "status.failed", fallback: "Failed", color: "text-danger-500", dot: "bg-danger-500" },
}

interface SyncStatusBadgeProps {
  status: SyncStatus
  className?: string
}

export function SyncStatusBadge({ status, className }: SyncStatusBadgeProps) {
  const { t } = useTranslation()
  const cfg = statusConfig[status]

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cfg.color, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {t(cfg.labelKey, cfg.fallback)}
    </span>
  )
}
