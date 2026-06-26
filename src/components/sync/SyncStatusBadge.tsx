"use client"

import { cn } from "@/lib/utils"
import type { SyncStatus } from "@/types/record"

const statusConfig: Record<SyncStatus, { label: string; color: string; dot: string }> = {
  local: { label: "Local", color: "text-pencil", dot: "bg-pencil" },
  pending: { label: "En attente", color: "text-warning-500", dot: "bg-warning-500" },
  synced: { label: "Synchronisé", color: "text-success-500", dot: "bg-success-500" },
  conflict: { label: "Conflit", color: "text-warning-500", dot: "bg-warning-500" },
  failed: { label: "Échec", color: "text-danger-500", dot: "bg-danger-500" },
}

interface SyncStatusBadgeProps {
  status: SyncStatus
  className?: string
}

export function SyncStatusBadge({ status, className }: SyncStatusBadgeProps) {
  const cfg = statusConfig[status]

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cfg.color, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  )
}
