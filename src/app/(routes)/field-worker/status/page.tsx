"use client"

import { useEffect, useState } from "react"
import { useSyncStore } from "@/stores/syncStore"
import { useStorageQuota } from "@/hooks/useStorageQuota"
import { SyncButton } from "@/components/sync/SyncButton"
import { Wifi, WifiOff, Database, AlertTriangle, CheckCircle2, Clock } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o"
  const units = ["o", "Ko", "Mo", "Go"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function formatTime(ts: number | null): string {
  if (!ts) return "Jamais"
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export default function FieldWorkerStatus() {
  const { isOnline, isSyncing, pendingCount, lastAttemptAt, lastSuccessfulSyncAt, lastError, conflicts } = useSyncStore()
  const user = useAuthStore((s) => s.user)
  const quota = useStorageQuota()
  const [recordCount, setRecordCount] = useState<number | null>(null)

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
        <h1 className="font-display text-2xl font-bold text-ink-black tracking-tight">État de synchronisation</h1>
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
          <p className="text-sm font-semibold text-ink-black">{isOnline ? "En ligne" : "Hors ligne"}</p>
          <p className="text-xs text-pencil">
            {isOnline
              ? "Les données se synchronisent automatiquement."
              : "Vos enregistrements sont sauvegardés localement."}
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
          label="En attente de synchronisation"
          value={String(pendingCount)}
          accent={pendingCount > 0 ? "text-warning-500" : "text-ink-black"}
        />
        <StatRow
          icon={<CheckCircle2 size={16} className="text-success-500" />}
          label="Dernière synchronisation"
          value={formatTime(lastSuccessfulSyncAt)}
          mono
        />
        <StatRow
          icon={<Clock size={16} className="text-pencil" />}
          label="Dernière tentative"
          value={formatTime(lastAttemptAt)}
          mono
        />
        {lastError ? (
          <StatRow
            icon={<AlertTriangle size={16} className="text-danger-500" />}
            label="Dernière erreur"
            value={lastError}
            accent="text-danger-500"
          />
        ) : null}
        <StatRow
          icon={<AlertTriangle size={16} className={conflicts.length > 0 ? "text-clay" : "text-pencil"} />}
          label="Conflits à résoudre"
          value={String(conflicts.length)}
          accent={conflicts.length > 0 ? "text-clay" : "text-ink-black"}
        />
        <StatRow
          icon={<Database size={16} className="text-ink-blue" />}
          label="Enregistrements locaux"
          value={recordCount === null ? "…" : String(recordCount)}
          mono
        />
      </dl>

      {/* Storage quota */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-pencil">Stockage de l&apos;appareil</h2>
        <div className="border border-grid-line rounded-md bg-white p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-black">{formatBytes(quota.usage)} utilisés</span>
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
            <p className="text-xs text-ink-red">Espace de stockage faible. Synchronisez puis libérez de l&apos;espace.</p>
          ) : (
            <p className="text-xs text-pencil">
              {quota.quota > 0 ? `${formatBytes(quota.quota)} disponibles au total` : "Estimation indisponible"}
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
