'use client'

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, CheckCircle, Clock, AlertTriangle, XCircle, ShieldCheck, GitMerge, PackageCheck, ShieldOff } from "lucide-react"
import type { RecordData } from "@/types/record"
import { formatDate } from "@/lib/utils"
import { useAuthStore } from "@/stores/authStore"
import type { WorkflowDefinition } from "@/types/workflow"
import { FieldRenderer } from "@/components/fields/FieldRenderer"
import { groupFieldsBySection, recordTitle, sectionLabel } from "@/lib/workflows/runtime"
import { db } from "@/lib/db/indexeddb"
import { runBackgroundSync } from "@/lib/sync/run-background-sync"
import { generateId } from "@/lib/utils"
import { useSyncStore } from "@/stores/syncStore"
import type { MutationEntry } from "@/types/sync"

const statusConfig: Record<string, { label: string; color: string; border: string; bg: string; icon: typeof AlertTriangle }> = {
  draft: { label: "Brouillon", color: "text-pencil", border: "border-pencil", bg: "bg-pencil/5", icon: Clock },
  pending_sync: { label: "En attente", color: "text-warning-500", border: "border-warning-500", bg: "bg-warning-500/5", icon: Clock },
  submitted: { label: "Soumis", color: "text-warning-500", border: "border-warning-500", bg: "bg-warning-500/5", icon: Clock },
  pending: { label: "En revue", color: "text-warning-500", border: "border-warning-500", bg: "bg-warning-500/5", icon: Clock },
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
  if (record.status === "pending_sync" || record.status === "submitted" || record.status === "pending" || (record.syncStatus === "pending")) {
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
  const { t, i18n } = useTranslation()
  const params = useParams()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const [record, setRecord] = useState<RecordData | null>(null)
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draftFields, setDraftFields] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  const id = params.id as string

  useEffect(() => {
    async function load() {
      let loadedLocal = false
      let workflowId = ""
      try {
        const { db } = await import("@/lib/db/indexeddb")
        const found = await db.getRecord(id, user?.orgId)
        if (found && (!user?.orgId || found.orgId === user.orgId)) {
          setRecord(found)
          setDraftFields(found.fields ?? {})
          workflowId = found.workflowId || workflowId
          const workflow = await db.getWorkflow(found.workflowId, found.orgId || user?.orgId)
          if (workflow) setWorkflow(workflow)
          loadedLocal = true
          setLoading(false)
        }
      } catch { /* IndexedDB not ready */ }
      try {
        const workflowIds = workflowId
          ? [workflowId]
          : await fetch("/api/workflows", { credentials: "include" })
            .then((res) => res.ok ? res.json() : [])
            .then((workflows) => Array.isArray(workflows) ? workflows.map((workflow: { id?: string }) => workflow.id).filter(Boolean) : [])
        for (const candidateWorkflowId of workflowIds) {
          const res = await fetch(`/api/workflows/${candidateWorkflowId}/records`, { credentials: "include" })
          const records = res.ok ? await res.json() : []
          if (!Array.isArray(records)) continue
          const fresh = records.find((r: RecordData) => r.id === id) ?? null
          if (fresh) {
            setRecord(fresh)
            setDraftFields(fresh.fields ?? {})
            const { db } = await import("@/lib/db/indexeddb")
            await db.putRecord(fresh)
            const definition = await db.getWorkflow(fresh.workflowId, fresh.orgId || user?.orgId)
            if (definition) setWorkflow(definition)
            break
          }
        }
        if (!loadedLocal) setRecord((current) => current)
      } catch {
        setRecord((current) => current)
      }
      setLoading(false)
    }
    load()
  }, [id, user?.orgId])

  const setFieldValue = (key: string, value: unknown) => {
    setDraftFields((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const validate = () => {
    const next: Record<string, string> = {}
    for (const field of workflow?.entity.fields ?? []) {
      if (!field.required || field.type === "gps" || field.type === "photo") continue
      const value = draftFields[field.key]
      const missing = Array.isArray(value) ? value.length === 0 : value === undefined || value === null || value === ""
      if (missing) next[field.key] = t("common.required")
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function saveEdit() {
    if (!record || !workflow || !user?.orgId) return
    if (!validate()) return
    const now = Date.now()
    const deviceId = user.deviceId || record.deviceId || "web"
    const updated: RecordData = {
      ...record,
      fields: { ...draftFields },
      syncStatus: "pending",
      status: record.status === "synced" ? "pending_sync" : record.status,
      updatedAt: now,
      version: record.version + 1,
    }
    const mutation: MutationEntry = {
      client_id: `update-${record.id}-${generateId()}`,
      device_id: deviceId,
      operation: "update",
      resource: "record",
      workflow_id: record.workflowId,
      record_id: record.id,
      payload: {
        fields: updated.fields,
        status: updated.status,
        state: updated.state,
        syncStatus: "pending",
        workflowVersion: record.workflowVersion,
      },
      client_timestamp: now,
      base_version: record.version,
      base_fields: { ...(record.fields ?? {}) },
      status: "PENDING",
      retry_count: 0,
      last_error: null,
      enqueued_at: now,
    }
    setSaving(true)
    try {
      setSaveError("")
      await db.putRecord(updated)
      await db.enqueueMutation(mutation)
      useSyncStore.getState().setPendingCount((await db.getPendingMutations()).length)
      setRecord(updated)
      setEditing(false)
      void runBackgroundSync(user)
    } catch {
      setSaveError(t("record.saveFailed", "Could not save changes locally."))
    } finally {
      setSaving(false)
    }
  }

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

  const sections = workflow?.entity.fields.length ? groupFieldsBySection(workflow.entity.fields) : []

  return (
    <div className="py-4">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-pencil mb-4 min-h-[44px]">
        <ArrowLeft size={16} />
        {t("common.back")}
      </button>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border rotate-[-2deg] ${statusCfg.border} ${statusCfg.bg}`}>
          <StatusIcon size={18} className={statusCfg.color} />
          <span className={`text-xs font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
        </div>
        <span className="text-xs font-mono text-pencil">{record.id.slice(0, 8)}</span>
      </div>
      {workflow && (
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => { setDraftFields(record.fields ?? {}); setErrors({}); setEditing(false) }}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={saveEdit}>
                {t("common.save")}
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              {t("record.edit", "Edit")}
            </Button>
          )}
        </div>
      )}
      </div>

      <h1 className="mb-4 font-display text-2xl font-semibold text-ink-black">{recordTitle(record, workflow)}</h1>
      {saveError && <div className="mb-4 rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">{saveError}</div>}
      {record.workflowVersionMismatch && (
        <div className="mb-4 rounded-md border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-sm leading-6 text-warning-600">
          {t("record.workflowVersionMismatch", "This record was created on an older workflow version. Review before final approval.")}
        </div>
      )}

      <div className="space-y-4 mb-8">
        {sections.length > 0 ? sections.map(({ section, fields }) => (
          <section key={section} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-pencil">{sectionLabel(section, i18n.language)}</h2>
            {fields.map((field) => (
              <FieldRenderer
                key={field.id || field.key}
                field={field}
                value={editing ? draftFields[field.key] : record.fields[field.key]}
                error={errors[field.key]}
                readOnly={!editing}
                language={i18n.language}
                attachmentContext={{ orgId: user?.orgId, workflowId: record.workflowId, recordId: record.id }}
                onChange={(value) => setFieldValue(field.key, value)}
              />
            ))}
          </section>
        )) : Object.entries(record.fields ?? {}).map(([key, value]) => (
          <div key={key} className="grid gap-1 rounded-md border border-graph-line bg-white px-3 py-2 sm:grid-cols-[12rem_1fr]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-pencil">{key}</span>
            <span className="text-sm text-ink-black">{String(value ?? "-")}</span>
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
