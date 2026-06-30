"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Inbox, CheckCircle2, XCircle, AlertTriangle, Clock, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { RecordData } from "@/types/record"
import { useWorkflowContext } from "@/hooks/useWorkflowContext"
import { recordTitle, workflowLabel } from "@/lib/workflows/runtime"
import type { WorkflowDefinition } from "@/types/workflow"
import { db } from "@/lib/db/indexeddb"
import { useAuthStore } from "@/stores/authStore"
import { onInvalidation } from "@/lib/invalidation"

const statusConfig: Record<string, { variant: "warning" | "success" | "danger" | "info"; label: string }> = {
  pending_sync: { variant: "warning", label: "dashboard.pending" },
  submitted: { variant: "warning", label: "dashboard.pending" },
  pending: { variant: "warning", label: "dashboard.pending" },
  approved: { variant: "success", label: "dashboard.approvedToday" },
  rejected: { variant: "danger", label: "dashboard.rejected" },
  in_conflict: { variant: "info", label: "dashboard.conflicts" },
  synced: { variant: "warning", label: "dashboard.pending" },
}

export default function SupervisorDashboard() {
  const { t, i18n } = useTranslation()
  const { activeWorkflow, activeWorkflowId, workflows } = useWorkflowContext()
  const user = useAuthStore((state) => state.user)
  const [filter, setFilter] = useState("all")
  const [scope, setScope] = useState<"current" | "all">("current")
  const [records, setRecords] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => onInvalidation(["records", "review", "sync", "conflicts"], () => setRefreshKey((value) => value + 1)), [])

  useEffect(() => {
    if (!activeWorkflowId && scope === "current") {
      setLoading(false)
      return
    }
    setLoading(true)
    const workflowIds = scope === "all" ? workflows.map((workflow) => workflow.id) : activeWorkflowId ? [activeWorkflowId] : []
    Promise.all(workflowIds.map(async (workflowId) => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/records`, { credentials: "include" })
        const data = res.ok ? await res.json() : []
        return Array.isArray(data) ? data.filter((record: RecordData) => record.workflowId === workflowId) : []
      } catch {
        const local = user?.orgId ? await db.getAllRecordsForOrg(user.orgId) : []
        return local.filter((record) => record.workflowId === workflowId)
      }
    }))
      .then(groups => setRecords(groups.flat()))
      .catch(async () => {
        const local = user?.orgId ? await db.getAllRecordsForOrg(user.orgId).catch(() => []) : []
        setRecords(scope === "all" ? local : local.filter((record) => record.workflowId === activeWorkflowId))
      })
      .finally(() => setLoading(false))
  }, [activeWorkflowId, refreshKey, scope, user?.orgId, workflows])

  const workflowsById = new Map<string, WorkflowDefinition>(workflows.map((workflow) => [workflow.id, workflow]))

  const stats = [
    { label: t("dashboard.pending"), count: records.filter(r => r.status === "submitted" || r.status === "pending" || r.status === "pending_sync").length, icon: Clock, color: "text-warning-500", bg: "bg-warning-500/10" },
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
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-black">{t("nav.dashboard")}</h1>
          {activeWorkflow && <p className="mt-0.5 text-xs text-pencil">{workflowLabel(activeWorkflow, i18n.language)}</p>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["current", "all"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setScope(key)}
              className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-medium transition-colors ${
                scope === key ? "bg-ink-blue text-white" : "border border-grid-line bg-white text-pencil hover:bg-graph-paper"
              }`}
            >
              {key === "current" ? t("home.currentWorkflow", "Current workflow") : t("home.allWorkflows", "All workflows")}
            </button>
          ))}
        </div>
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
                const cfg = statusConfig[r.status] || statusConfig[r.syncStatus] || statusConfig.pending_sync
                const rowWorkflow = scope === "all" ? workflowsById.get(r.workflowId) ?? activeWorkflow : activeWorkflow
                return (
                  <div key={r.id} className="flex flex-col gap-3 px-4 py-4 hover:bg-graph-paper sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                      <span className={`h-2 w-2 rounded-full ${cfg.variant === "warning" ? "bg-warning-500" : cfg.variant === "success" ? "bg-antiseptic-green" : cfg.variant === "danger" ? "bg-danger-500" : "bg-scrub-blue"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-black">{recordTitle(r, rowWorkflow)}</p>
                        <p className="text-xs text-pencil">
                          {scope === "all" && rowWorkflow ? `${workflowLabel(rowWorkflow, i18n.language)} · ` : ""}
                          {t("dashboard.submitter")} {r.createdBy} · {new Date(r.updatedAt).toLocaleTimeString(i18n.language?.startsWith("en") ? "en-US" : "fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pl-5 sm:justify-end sm:pl-0">
                      <Badge variant={cfg.variant}>{t(cfg.label)}</Badge>
                      <Link href={`/supervisor/review?id=${r.id}`}>
                        <Button variant="secondary" size="sm">{t("supervisor.review")}</Button>
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
