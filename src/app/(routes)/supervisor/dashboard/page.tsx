"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Inbox, CheckCircle2, XCircle, AlertTriangle, Clock, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { RecordData } from "@/types/record"

const statusConfig: Record<string, { variant: "warning" | "success" | "danger" | "info"; label: string }> = {
  pending_sync: { variant: "warning", label: "dashboard.pending" },
  approved: { variant: "success", label: "dashboard.approvedToday" },
  rejected: { variant: "danger", label: "dashboard.rejected" },
  in_conflict: { variant: "info", label: "dashboard.conflicts" },
  synced: { variant: "success", label: "dashboard.approvedToday" },
}

export default function SupervisorDashboard() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState("all")
  const [records, setRecords] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/workflows/wf-1/records", { credentials: "include" })
      .then(res => res.json())
      .then(data => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [])

  const stats = [
    { label: t("dashboard.pending"), count: records.filter(r => r.syncStatus === "pending").length, icon: Clock, color: "text-warning-500", bg: "bg-warning-500/10" },
    { label: t("dashboard.approvedToday"), count: records.filter(r => r.status === "approved").length, icon: CheckCircle2, color: "text-antiseptic-green", bg: "bg-antiseptic-green/10" },
    { label: t("dashboard.rejected"), count: records.filter(r => r.status === "rejected").length, icon: XCircle, color: "text-danger-500", bg: "bg-danger-500/10" },
    { label: t("dashboard.conflicts"), count: records.filter(r => r.syncStatus === "conflict").length, icon: AlertTriangle, color: "text-scrub-blue", bg: "bg-scrub-blue/10" },
  ]

  const filtered = records.filter(r => {
    if (filter === "priority") return r.syncStatus === "conflict"
    if (filter === "today") return r.updatedAt > Date.now() - 86400000
    return true
  })

  return (
    <div className="space-y-6 sm:p-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-black">{t("supervisor.title", "Tableau de bord")}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:mb-8 sm:grid-cols-4 sm:gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-3 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-[11px] uppercase tracking-wide text-pencil sm:text-xs sm:tracking-wider">{s.label}</p>
              <div className={`flex h-9 w-9 items-center justify-center rounded-md ${s.bg}`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
            </div>
            <p className="mt-2 font-display text-3xl font-bold text-ink-black">{loading ? "—" : s.count}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-graph-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h2 className="font-medium text-ink-black">{t("supervisor.reviewQueue", "File d'attente")}</h2>
            <div className="flex flex-wrap gap-2">
              {["all", "priority", "today"].map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${filter === f ? "bg-lake-deep text-white" : "bg-graph-paper text-pencil hover:bg-graph-line"}`}>
                  {f === "all" ? t("common.all", "Tous") : f === "priority" ? t("common.priority", "Prioritaire") : t("common.today", "Aujourd'hui")}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-graph-line">
              {[1, 2, 3].map((i) => <div key={i} className="flex items-center justify-between px-6 py-4"><div className="h-4 w-48 animate-pulse rounded bg-graph-line" /><div className="h-4 w-24 animate-pulse rounded bg-graph-line" /></div>)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Inbox className="mb-3 h-8 w-8 text-pencil" />
              <p className="text-sm text-pencil">{t("supervisor.emptyQueue", "File d'attente vide")}</p>
              <p className="mt-1 text-xs text-pencil-light">{t("supervisor.emptyQueueHint", "Toutes les soumissions ont été examinées.")}</p>
            </div>
          ) : (
            <div className="divide-y divide-graph-line">
              {filtered.map((r) => {
                const cfg = statusConfig[r.syncStatus] || statusConfig.pending_sync
                return (
                  <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-graph-paper">
                    <div className="flex items-center gap-4">
                      <span className={`h-2 w-2 rounded-full ${cfg.variant === "warning" ? "bg-warning-500" : cfg.variant === "success" ? "bg-antiseptic-green" : cfg.variant === "danger" ? "bg-danger-500" : "bg-scrub-blue"}`} />
                      <div>
                        <p className="text-sm font-medium text-ink-black">{String(r.fields?.household_name || r.id)}</p>
                        <p className="text-xs text-pencil">{t("supervisor.submittedBy", "Soumis par")} {r.createdBy} · {new Date(r.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={cfg.variant}>{t(cfg.label)}</Badge>
                      <Link href={`/supervisor/review?id=${r.id}`}>
                        <Button variant="secondary" size="sm">{t("supervisor.examine", "Examiner")}</Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
