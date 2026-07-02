"use client"

import { useEffect, useState } from "react"
import { useSyncStore } from "@/stores/syncStore"
import { useStorageQuota } from "@/hooks/useStorageQuota"
import { SyncButton } from "@/components/sync/SyncButton"
import { Wifi, WifiOff, Database, AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"
import { useTranslation } from "react-i18next"

function formatBytes(bytes: number, language?: string): string {
  if (bytes === 0) return language?.startsWith("en") ? "0 B" : "0 o"
  const units = language?.startsWith("en") ? ["B", "KB", "MB", "GB"] : ["o", "Ko", "Mo", "Go"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function formatTime(ts: number | null, language?: string, never = "Never"): string {
  if (!ts) return never
  return new Date(ts).toLocaleTimeString(language?.startsWith("en") ? "en-US" : "fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export default function FieldWorkerStatus() {
  const { t, i18n } = useTranslation()
  const { isOnline, isSyncing, pendingCount, lastAttemptAt, lastSuccessfulSyncAt, lastError, conflicts } = useSyncStore()
  const user = useAuthStore((s) => s.user)
  const quota = useStorageQuota()
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const language = i18n.resolvedLanguage || i18n.language

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { db } = await import("@/lib/db/indexeddb")
        const all = user?.orgId ? await db.getAllRecordsForOrg(user.orgId) : await db.getAllRecords()
        if (!cancelled) setRecordCount(all.length)
      } catch {
        if (!cancelled) setRecordCount(0)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user?.orgId])

  return (
    <div className="py-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-black tracking-tight">{t("statusPage.title")}</h1>
        <SyncButton />
      </div>

      {/* Connection state band */}
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-md border ${
          isOnline ? "border-success-500/30 bg-success-500/5" : "border-pencil/30 bg-graph-paper"
        }`}
      >
        {isOnline ? (
          <Wifi size={20} className="text-success-500 shrink-0" />
        ) : (
          <WifiOff size={20} className="text-pencil shrink-0" />
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink-black">{isOnline ? t("common.online") : t("common.offline")}</p>
          <p className="text-xs text-pencil">
            {isOnline
              ? t("statusPage.onlineBody")
              : t("statusPage.offlineBody")}
          </p>
        </div>
        {isSyncing ? (
          <span className="text-xs font-mono text-info-500 animate-sync-pulse">SYNC…</span>
        ) : null}
      </div>

      {/* Ledger of counters */}
      <dl className="border border-grid-line rounded-md divide-y divide-grid-line bg-white">
        <StatRow
          icon={<Clock size={16} className="text-warning-500" />}
          label={t("statusPage.pendingSync")}
          value={String(pendingCount)}
          accent={pendingCount > 0 ? "text-warning-500" : "text-ink-black"}
        />
        <StatRow
          icon={<CheckCircle2 size={16} className="text-success-500" />}
          label={t("statusPage.lastSuccessfulSync")}
          value={formatTime(lastSuccessfulSyncAt, language, t("statusPage.never"))}
          mono
        />
        <StatRow
          icon={<Clock size={16} className="text-pencil" />}
          label={t("statusPage.lastAttempt")}
          value={formatTime(lastAttemptAt, language, t("statusPage.never"))}
          mono
        />
        {lastError ? (
          <StatRow
            icon={<AlertTriangle size={16} className="text-danger-500" />}
            label={t("statusPage.lastError")}
            value={lastError}
            accent="text-danger-500"
          />
        ) : null}
        <StatRow
          icon={<AlertTriangle size={16} className={conflicts.length > 0 ? "text-clay" : "text-pencil"} />}
          label={t("statusPage.conflictsToResolve")}
          value={String(conflicts.length)}
          accent={conflicts.length > 0 ? "text-clay" : "text-ink-black"}
        />
        <StatRow
          icon={<Database size={16} className="text-ink-blue" />}
          label={t("statusPage.localRecords")}
          value={recordCount === null ? "..." : String(recordCount)}
          mono
        />
      </dl>

      {/* Storage quota */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-pencil">{t("statusPage.deviceStorage")}</h2>
        <div className="border border-grid-line rounded-md bg-white p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-black">{t("statusPage.used", { value: formatBytes(quota.usage, language) })}</span>
            <span className="font-mono text-pencil">
              {quota.quota > 0 ? `${quota.percentageUsed.toFixed(1)} %` : "—"}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-graph-paper overflow-hidden">
            <div
              className={`h-full rounded-full ${quota.isNearLimit ? "bg-ink-red" : "bg-ink-blue"}`}
              style={{ width: `${Math.min(100, quota.percentageUsed)}%` }}
            />
          </div>
          {quota.isNearLimit ? (
            <p className="text-xs text-ink-red">{t("statusPage.storageLow")}</p>
          ) : (
            <p className="text-xs text-pencil">
              {t("statusPage.storageUse", { value: formatBytes(quota.usage, language) })}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function StatRow({
  icon,
  label,
  value,
  mono,
  accent = "text-ink-black",
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
  accent?: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="shrink-0">{icon}</span>
      <dt className="flex-1 text-sm text-ink-black">{label}</dt>
      <dd className={`text-sm font-semibold ${mono ? "font-mono" : ""} ${accent}`}>{value}</dd>
    </div>
  )
}
