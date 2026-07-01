'use client'

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { useSyncStore } from "@/stores/syncStore"
import { SyncButton } from "@/components/sync/SyncButton"
import { ChevronRight, AlertTriangle, Clock, MapPin } from "lucide-react"
import Link from "next/link"
import type { RecordData } from "@/types/record"
import type { ConflictRecord } from "@/types/sync"
import { useAuthStore } from "@/stores/authStore"
import { useWorkflowContext } from "@/hooks/useWorkflowContext"
import { recordSubtitle, recordTitle, workflowLabel } from "@/lib/workflows/runtime"
import type { WorkflowDefinition } from "@/types/workflow"
import { onInvalidation } from "@/lib/invalidation"

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
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { activeWorkflow, activeWorkflowId, workflows, loading: workflowsLoading } = useWorkflowContext()
  const { pendingCount } = useSyncStore()
  const [records, setRecords] = useState<RecordData[]>([])
  const [loading, setLoading] = useState(true)
  const [conflictCount, setConflictCount] = useState(0)
  const [scope, setScope] = useState<"current" | "all">("current")
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => onInvalidation(["records", "sync", "conflicts"], () => setRefreshKey((value) => value + 1)), [])

  useEffect(() => {
    let cancelled = false
    if (!user?.orgId || (!activeWorkflowId && scope === "current")) {
      if (!workflowsLoading && workflows.length > 1) router.replace("/field-worker/pick-workflow")
      setLoading(false)
      return
    }
    setLoading(true)
    async function load() {
      try {
        const { db } = await import("@/lib/db/indexeddb")
        let all = user?.orgId ? await db.getAllRecordsForOrg(user.orgId) : await db.getAllRecords()
        all = scope === "all" ? all : all.filter((record) => record.workflowId === activeWorkflowId)
        if (all.length === 0) {
          try {
            const workflowIds = scope === "all" ? workflows.map((workflow) => workflow.id) : activeWorkflowId ? [activeWorkflowId] : []
            const serverRecords = await Promise.all(workflowIds.map(async (workflowId) => {
              const response = await fetch(`/api/workflows/${workflowId}/records`, { credentials: "include" })
              const server = response.ok ? await response.json() : []
              return Array.isArray(server) ? server.filter((record: RecordData) => record.workflowId === workflowId) : []
            }))
            all = serverRecords.flat()
            await Promise.all(all.map((record) => db.putRecord(record)))
          } catch {
            // Keep the local empty state when the device is offline.
          }
        }
        if (cancelled) return
        setRecords(all)
        const conflicts: ConflictRecord[] = await db.getConflicts(user?.orgId)
        const recordIds = new Set(all.map((record) => record.id))
        setConflictCount(conflicts.filter(c => c.status === "OPEN" && recordIds.has(c.record_id)).length)
      } catch { /* IndexedDB not ready */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [activeWorkflowId, refreshKey, router, scope, user?.orgId, workflows, workflows.length, workflowsLoading])

  const urgent = records.filter((r) => r.status === "in_conflict" || r.status === "rejected" || r.status === "blocked")
  const pending = records.filter((r) => r.syncStatus === "pending" || r.syncStatus === "local")
  const today = records.filter((r) => {
    const startOfDay = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()
    return r.createdAt >= startOfDay
  }).sort((a, b) => b.createdAt - a.createdAt)
  const visibleRecords = today.length > 0 ? today : [...records].sort((a, b) => b.updatedAt - a.updatedAt)

  const workflowsById = new Map<string, WorkflowDefinition>(workflows.map((workflow) => [workflow.id, workflow]))

  function RecordRow({ r }: { r: RecordData }) {
    const rowWorkflow = scope === "all" ? workflowsById.get(r.workflowId) ?? activeWorkflow : activeWorkflow
    return (
      <Link
        href={`/field-worker/record/${r.id}`}
        className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-graph-line bg-white min-h-[44px] hover:bg-graph-paper transition-colors"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[r.status] || "bg-pencil"}`} />
        <span className="flex-1 min-w-0">
          <span className="text-sm font-medium text-ink-black truncate block">{recordTitle(r, rowWorkflow)}</span>
          <span className="text-xs text-pencil">
            {scope === "all" && rowWorkflow ? `${workflowLabel(rowWorkflow, i18n.language)} · ` : ""}
            {recordSubtitle(r, rowWorkflow, i18n.language)}
          </span>
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
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-black tracking-tight">{t("dashboard.fieldWorker")}</h1>
          {activeWorkflow && <p className="mt-0.5 text-xs text-pencil">{workflowLabel(activeWorkflow, i18n.language)}</p>}
        </div>
        <SyncButton />
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

      {loading && records.length === 0 ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-[44px] rounded-md bg-graph-paper animate-pulse" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12">
          <MapPin size={24} className="mx-auto text-pencil/40 mb-2" />
          <p className="text-sm text-pencil">{t("home.noRecords")}</p>
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
            {visibleRecords.map((r) => <RecordRow key={r.id} r={r} />)}
          </div>
        )}
      </section>
      </>
      )}
    </div>
  )
}
