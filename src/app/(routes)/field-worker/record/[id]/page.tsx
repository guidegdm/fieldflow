'use client'

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, XCircle, ShieldCheck, GitMerge, PackageCheck, ShieldOff } from "lucide-react"
import type { RecordData } from "@/types/record"
import { formatDate } from "@/lib/utils"

const statusConfig: Record<string, { label: string; color: string; border: string; bg: string; icon: typeof AlertTriangle }> = {
  draft: { label: "Brouillon", color: "text-pencil", border: "border-pencil", bg: "bg-pencil/5", icon: Clock },
  pending_sync: { label: "En attente", color: "text-warning-500", border: "border-warning-500", bg: "bg-warning-500/5", icon: Clock },
  synced: { label: "Synchronisé", color: "text-success-500", border: "border-success-500", bg: "bg-success-500/5", icon: CheckCircle },
  approved: { label: "Approuvé", color: "text-success-500", border: "border-success-500", bg: "bg-success-500/5", icon: ShieldCheck },
  rejected: { label: "Rejeté", color: "text-danger-500", border: "border-danger-500", bg: "bg-danger-500/5", icon: XCircle },
  in_conflict: { label: "Conflit", color: "text-warning-500", border: "border-warning-500", bg: "bg-warning-500/5", icon: AlertTriangle },
  conflict_resolved: { label: "Conflit résolu", color: "text-success-500", border: "border-success-500", bg: "bg-success-500/5", icon: GitMerge },
  distributed: { label: "Distribué", color: "text-success-500", border: "border-success-500", bg: "bg-success-500/5", icon: PackageCheck },
  blocked: { label: "Bloqué", color: "text-danger-500", border: "border-danger-500", bg: "bg-danger-500/5", icon: ShieldOff },
}

interface AuditEvent {
  id: string
  type: "created" | "submitted" | "synced" | "conflict" | "resolved"
  timestamp: number
  detail?: string
}

function buildAuditTimeline(record: RecordData): AuditEvent[] {
  const events: AuditEvent[] = [{ id: "e1", type: "created", timestamp: record.createdAt }]
  if (record.status === "pending_sync" || (record.syncStatus === "pending")) {
    events.push({ id: "e2", type: "submitted", timestamp: record.updatedAt })
  }
  if (record.syncedAt) {
    events.push({ id: "e3", type: "synced", timestamp: record.syncedAt })
  }
  if (record.status === "in_conflict") {
    events.push({ id: "e4", type: "conflict", timestamp: record.updatedAt })
  }
  if (record.status === "conflict_resolved") {
    events.push({ id: "e4", type: "conflict", timestamp: record.updatedAt - 3600000 })
    events.push({ id: "e5", type: "resolved", timestamp: record.updatedAt })
  }
  return events.sort((a, b) => a.timestamp - b.timestamp)
}

const eventIcons: Record<string, typeof Clock> = {
  created: Clock,
  submitted: Clock,
  synced: CheckCircle,
  conflict: AlertTriangle,
  resolved: CheckCircle,
}

const eventColors: Record<string, string> = {
  created: "bg-pencil",
  submitted: "bg-warning-500",
  synced: "bg-success-500",
  conflict: "bg-warning-500",
  resolved: "bg-success-500",
}

export default function RecordDetailPage() {
  const { t } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const [record, setRecord] = useState<RecordData | null>(null)
  const [loading, setLoading] = useState(true)

  const id = params.id as string

  useEffect(() => {
    async function load() {
      try {
        const { db } = await import("@/lib/db/indexeddb")
        const found = await db.getRecord(id)
        if (found) { setRecord(found); setLoading(false); return }
      } catch { /* IndexedDB not ready */ }
      try {
        const res = await fetch("/api/workflows/wf-1/records", { credentials: "include" })
        const records = res.ok ? await res.json() : []
        if (Array.isArray(records)) setRecord(records.find((r: RecordData) => r.id === id) ?? null)
      } catch { setRecord(null) }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="py-4 space-y-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!record) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-pencil">{t("common.noData")}</p>
        <Button variant="tertiary" onClick={() => router.back()} className="mt-4">{t("common.back")}</Button>
      </div>
    )
  }

  const statusCfg = statusConfig[record.status] || statusConfig.draft
  const StatusIcon = statusCfg.icon
  const timeline = buildAuditTimeline(record)

  const fields = [
    { label: t("records.householdName"), value: record.fields.household_name as string },
    { label: t("records.headOfHousehold"), value: record.fields.head_of_household as string },
    { label: t("records.householdSize"), value: record.fields.household_size as string },
    { label: t("records.shelterType"), value: record.fields.shelter_type ? t(`register.shelter_${record.fields.shelter_type as string}`) : "—" },
    { label: t("records.village"), value: record.fields.village as string },
    { label: t("records.gpsCoordinates"), value: record.fields.latitude || record.fields.longitude ? `${record.fields.latitude ?? "—"} / ${record.fields.longitude ?? "—"}` : "—" },
    { label: t("records.vulnerabilityScore"), value: record.fields.vulnerability_score ? `${record.fields.vulnerability_score}/5` : "—" },
    { label: t("records.needs"), value: Array.isArray(record.fields.needs) ? (record.fields.needs as string[]).map((n: string) => t(`register.need_${n}`)).join(", ") : "—" },
  ]

  return (
    <div className="py-4">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-pencil mb-4 min-h-[44px]">
        <ArrowLeft size={16} />
        {t("common.back")}
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border rotate-[-2deg] ${statusCfg.border} ${statusCfg.bg}`}>
          <StatusIcon size={18} className={statusCfg.color} />
          <span className={`text-xs font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
        </div>
        <span className="text-xs font-mono text-pencil">{record.id.slice(0, 8)}</span>
      </div>

      <div className="space-y-3 mb-8">
        {fields.map((f) => (
          <div key={f.label} className="flex items-baseline gap-2">
            <span className="text-[11px] uppercase text-pencil font-medium min-w-[7rem] text-right shrink-0">{f.label}</span>
            <span className="flex-1 border-b border-dotted border-grid-line min-w-0" />
            <span className="flex-1 text-sm text-ink-black">{f.value || "—"}</span>
          </div>
        ))}
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-pencil pb-2 mb-4 border-b border-graph-line">
          {t("record.auditTimeline")}
        </h2>
        <div className="relative pl-5">
          <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-graph-line" />
          <div className="space-y-4">
            {timeline.map((event, i) => {
              const EventIcon = eventIcons[event.type] || Clock
              return (
                <div key={event.id} className="relative">
                  <div className={`absolute -left-[17px] top-1 w-3 h-3 rounded-full border-2 border-white ${eventColors[event.type] || "bg-pencil"}`} />
                  <div className="flex items-start gap-3">
                    <EventIcon size={14} className="text-pencil shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-ink-black">{t(`record.${event.type}`)}</p>
                      <p className="text-xs text-pencil mt-0.5">{formatDate(event.timestamp)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
