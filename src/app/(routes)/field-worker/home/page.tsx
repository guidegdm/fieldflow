'use client'

import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useSyncStore } from "@/stores/syncStore"
import { SyncButton } from "@/components/sync/SyncButton"
import { ChevronRight, AlertTriangle, Clock, MapPin } from "lucide-react"
import Link from "next/link"
import type { RecordData } from "@/types/record"
import type { ConflictRecord } from "@/types/sync"

const statusDot: Record<string, string> = {
  draft: "bg-pencil",
  pending_sync: "bg-warning-500",
  synced: "bg-success-500",
  approved: "bg-success-500",
  rejected: "bg-danger-500",
  in_conflict: "bg-warning-500",
  conflict_resolved: "bg-success-500",
  distributed: "bg-success-500",
  blocked: "bg-danger-500",
}

export default function FieldWorkerHome() {
  const { t } = useTranslation()
  const { pendingCount } = useSyncStore()
  const [records, setRecords] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(true)
  const [conflictCount, setConflictCount] = useState(0)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    async function load() {
      try {
        const { db } = await import("@/lib/db/indexeddb")
        const all = await db.getAllRecords()
        setRecords(all)
        const conflicts: ConflictRecord[] = await db.getConflicts()
        setConflictCount(conflicts.filter(c => c.status === "OPEN").length)
      } catch { /* IndexedDB not ready */ }
      setLoading(false)
    }
    load()
  }, [])

  const urgent = records.filter((r) => r.status === "in_conflict" || r.status === "rejected" || r.status === "blocked")
  const pending = records.filter((r) => r.syncStatus === "pending" || r.syncStatus === "local")
  const today = records.filter((r) => {
    const startOfDay = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()
    return r.createdAt >= startOfDay
  }).sort((a, b) => b.createdAt - a.createdAt)

  function RecordRow({ r }: { r: RecordData }) {
    return (
      <Link
        href={`/field-worker/record/${r.id}`}
        className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-graph-line bg-white min-h-[44px] hover:bg-graph-paper transition-colors"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[r.status] || "bg-pencil"}`} />
        <span className="flex-1 min-w-0">
          <span className="text-sm font-medium text-ink-black truncate block">{r.fields.household_name as string}</span>
          <span className="text-xs text-pencil">{r.fields.household_size as string} pers. · {r.fields.shelter_type as string}</span>
        </span>
        <ChevronRight size={16} className="text-pencil shrink-0" />
      </Link>
    )
  }

  return (
    <div className="py-4 space-y-6">
      {conflictCount > 0 && (
        <Link
          href="/field-worker/conflicts"
          className="flex items-center gap-2 px-4 py-3 rounded-md bg-warning-500/10 border border-warning-500/40 text-warning-600 hover:bg-warning-500/15 transition-colors text-sm font-medium"
        >
          <AlertTriangle size={18} className="shrink-0 text-warning-500" />
          <span>{t("home.conflictsBanner", { count: conflictCount })}</span>
          <ChevronRight size={16} className="ml-auto shrink-0 text-warning-500/60" />
        </Link>
      )}

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-black tracking-tight">{t("dashboard.fieldWorker")}</h1>
        <SyncButton />
      </div>

      {loading && records.length === 0 ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-[44px] rounded-md bg-graph-paper animate-pulse" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12">
          <MapPin size={24} className="mx-auto text-pencil/40 mb-2" />
          <p className="text-sm text-pencil">Aucun enregistrement</p>
        </div>
      ) : (
      <>
      {urgent.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-danger-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-danger-500">{t("home.urgent")}</h2>
            <span className="ml-auto text-xs text-pencil">{urgent.length}</span>
          </div>
          <div className="space-y-1">
            {urgent.map((r) => (
              <div key={r.id} className="rounded-md border border-danger-500/20 bg-danger-500/5">
                <RecordRow r={r} />
              </div>
            ))}
          </div>
        </section>
      )}

      {pendingCount > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-warning-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-warning-500">{t("home.pendingSync")}</h2>
            <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-warning-500 text-white text-[10px] font-bold">{pendingCount}</span>
          </div>
          <div className="space-y-1">
            {pending.map((r) => <RecordRow key={r.id} r={r} />)}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-black">{t("home.today")}</h2>
          <span className="ml-auto text-xs text-pencil">{t("home.recordsCount", { count: today.length })}</span>
        </div>
        {today.length === 0 ? (
          <div className="text-center py-12">
            <MapPin size={24} className="mx-auto text-pencil/40 mb-2" />
            <p className="text-sm text-pencil">{t("home.noRecords")}</p>
          </div>
        ) : (
          <div className="space-y-1">
            {today.map((r) => <RecordRow key={r.id} r={r} />)}
          </div>
        )}
      </section>
      </>
      )}
    </div>
  )
}
