"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldCheck, ShieldX, AlertTriangle, ArrowLeft, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import type { RecordData } from "@/types/record"
import type { WorkflowDefinition, WorkflowTransition } from "@/types/workflow"
import { useWorkflowContext } from "@/hooks/useWorkflowContext"
import { FieldRenderer } from "@/components/fields/FieldRenderer"
import { groupFieldsBySection, recordTitle, sectionLabel } from "@/lib/workflows/runtime"
import { useAuthStore } from "@/stores/authStore"
import { hasAnyRoleAccess } from "@/lib/auth/roles"
import { db } from "@/lib/db/indexeddb"

type TimelineStatus = "success" | "default" | "warning" | "danger"

function fieldValue(record: RecordData | null, keys: string[], fallback = "-") {
  if (!record) return fallback
  for (const key of keys) {
    const value = record.fields?.[key] ?? record.fieldValues?.[key]
    if (value !== undefined && value !== null && value !== "") return String(value)
  }
  return fallback
}

function buildTimeline(record: RecordData): Array<{ label: string; timestamp: number; actor: string; status: TimelineStatus }> {
  const events: Array<{ label: string; timestamp: number; actor: string; status: TimelineStatus }> = [
    { label: "Créé", timestamp: record.createdAt, actor: record.createdBy || record.deviceId, status: "success" },
  ]

  if (record.syncedAt) {
    events.push({ label: "Synchronisé", timestamp: record.syncedAt, actor: "Système", status: "default" as const })
  }

  events.push({
    label: record.status === "approved" ? "Approuvé" : record.status === "rejected" ? "Rejeté" : "En revue",
    timestamp: record.updatedAt,
    actor: record.createdBy || record.deviceId,
    status: record.status === "approved" ? "success" : record.status === "rejected" ? "danger" : "warning",
  })

  return events.sort((a, b) => a.timestamp - b.timestamp)
}

export default function SupervisorReview() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useAuthStore((s) => s.user)
  const { activeWorkflow, activeWorkflowId } = useWorkflowContext()
  const [record, setRecord] = useState<RecordData | null>(null)
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const id = searchParams.get("id")
    if (!activeWorkflowId) {
      setLoading(false)
      return
    }
    setWorkflow(activeWorkflow)
    async function load() {
      try {
        const res = await fetch(`/api/workflows/${activeWorkflowId}/records`, { credentials: "include" })
        return res.ok ? await res.json() : []
      } catch {
        const local = user?.orgId ? await db.getAllRecordsForOrg(user.orgId) : []
        return local.filter((candidate) => candidate.workflowId === activeWorkflowId)
      }
    }
    load()
      .then((data) => {
        const records = Array.isArray(data) ? data as RecordData[] : []
        const role = user?.role || "supervisor"
        const requested = id ? records.find((r) => r.id === id) ?? null : null
        const nextRecord = requested ?? records.find((candidate) => activeWorkflow && reviewableTransitions(activeWorkflow, candidate, role).length > 0) ?? null
        setRecord(nextRecord)
      })
      .catch(() => setRecord(null))
      .finally(() => setLoading(false))
  }, [activeWorkflow, activeWorkflowId, searchParams, user?.orgId, user?.role])

  const timeline = useMemo(() => record ? buildTimeline(record) : [], [record])
  const availableTransitions = useMemo(() => {
    if (!record || !workflow) return []
    const current = normalizeStateId(workflow, record.state)
    const role = user?.role || "supervisor"
    return workflow.transitions.filter((transition) => {
      const from = normalizeStateId(workflow, transition.fromState)
      const roles = transition.requiredRoles ?? []
      return from === current && hasAnyRoleAccess(role, roles)
    })
  }, [record, user?.role, workflow])

  const handleSubmit = async (transition: WorkflowTransition) => {
    if (!record || !workflow) return
    const destructive = isRejectTransition(transition)
    if (destructive && !reason.trim()) return

    const now = Date.now()
    const status = statusForTransition(transition)
    const state = normalizeStateId(workflow, transition.toState)
    const reviewFields = {
      supervisor_review_action: status,
      supervisor_review_reason: reason.trim(),
      supervisor_reviewed_at: new Date(now).toISOString(),
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/sync/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          device_id: "supervisor-web",
          device_seq: 0,
          operations: [{
            client_id: `review-${record.id}-${now}`,
            device_id: "supervisor-web",
            operation: "update",
            resource: "record",
            workflow_id: record.workflowId,
            record_id: record.id,
            payload: {
              fields: reviewFields,
              status,
              state,
              syncStatus: "synced",
            },
            client_timestamp: now,
            base_version: record.version,
            base_fields: {
              supervisor_review_action: record.fields?.supervisor_review_action,
              supervisor_review_reason: record.fields?.supervisor_review_reason,
              supervisor_reviewed_at: record.fields?.supervisor_reviewed_at,
            },
            status: "PENDING",
            retry_count: 0,
            last_error: null,
            enqueued_at: now,
          }],
        }),
      })

      if (!res.ok) return
      router.push("/supervisor/dashboard")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="h-7 w-48 animate-pulse rounded bg-graph-line" />
        <div className="h-36 animate-pulse rounded-md bg-graph-line" />
      </div>
    )
  }

  if (!record) {
    return (
      <div className="max-w-3xl">
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-1.5 text-sm text-chart-gray hover:text-iodine-brown transition-colors">
          <ArrowLeft size={16} />
          {t("common.back")}
        </button>
        <Card className="border-graph-line">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <Inbox className="mb-3 h-8 w-8 text-chart-gray" />
            <p className="text-sm text-chart-gray">{t("supervisor.emptyQueue", "File d'attente vide")}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const head = fieldValue(record, ["head_of_household", "head_name", "household_name"], record.id)
  const sections = workflow?.entity.fields.length ? groupFieldsBySection(workflow.entity.fields) : []

  return (
    <div className="max-w-3xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-chart-gray hover:text-iodine-brown transition-colors">
        <ArrowLeft size={16} />
        {t("common.back")}
      </button>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-iodine-brown tracking-tight">{recordTitle(record, workflow) || head}</h1>
          <p className="text-sm text-chart-gray mt-1">
            {t("dashboard.submitter")} {record.createdBy || record.operator || "-"} · {record.deviceId}
          </p>
        </div>
        <Badge variant={record.status === "approved" ? "success" : record.status === "rejected" ? "danger" : "warning"} size="md" className="-rotate-1 border shadow-sm shrink-0">
          {record.status === "approved" ? t("dashboard.approvedToday") : record.status === "rejected" ? t("dashboard.rejected") : t("dashboard.pending")}
        </Badge>
      </div>

      <Card className="border-graph-line">
        <CardContent className="p-5 space-y-3">
          {record.workflowVersionMismatch && (
            <div className="rounded-md border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-sm leading-6 text-warning-600">
              {t("record.workflowVersionMismatch", "This record was created on an older workflow version. Review before final approval.")}
            </div>
          )}
          {sections.length > 0 ? sections.map(({ section, fields }) => (
            <section key={section} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-chart-gray">{sectionLabel(section)}</h2>
              {fields.map((field) => (
                <FieldRenderer key={field.id || field.key} field={field} value={record.fields[field.key]} readOnly language={i18n.language} />
              ))}
            </section>
          )) : (
            <div className="text-sm text-chart-gray">{head}</div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {availableTransitions.length === 0 ? (
          <p className="rounded-md border border-graph-line bg-graph-paper px-3 py-2 text-sm text-pencil">
            {t("supervisor.noAvailableTransitions", "No review actions are available for this state.")}
          </p>
        ) : availableTransitions.map((transition) => {
          const danger = isRejectTransition(transition)
          const warning = isReturnTransition(transition)
          return (
            <Button
              key={transition.id}
              variant={danger ? "danger" : warning ? "secondary" : "primary"}
              className={`${selectedTransitionId === transition.id ? "ring-2 ring-ink-blue" : ""} ${!danger && !warning ? "bg-antiseptic-green hover:bg-antiseptic-green/90" : ""}`}
              onClick={() => {
                setReason("")
                setSelectedTransitionId(selectedTransitionId === transition.id ? null : transition.id)
              }}
            >
              {danger ? <ShieldX size={16} /> : warning ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
              {i18n.language?.startsWith("en") ? transition.labelEn || transition.label : transition.label || transition.labelEn}
            </Button>
          )
        })}
      </div>

      {selectedTransitionId && (() => {
        const transition = availableTransitions.find((candidate) => candidate.id === selectedTransitionId)
        if (!transition) return null
        const danger = isRejectTransition(transition)
        const warning = isReturnTransition(transition)
        return (
        <div className={`space-y-3 p-4 rounded-md border ${danger ? "border-danger-500/30 bg-danger-500/5" : warning ? "border-warning-500/30 bg-warning-500/5" : "border-antiseptic-green/30 bg-antiseptic-green/5"}`}>
          {(danger || warning) && (
          <Textarea
            label={t("supervisor.rejectionReason")}
            placeholder={danger ? t("supervisor.rejectionReasonRequired") : t("supervisor.requestChanges")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={submitting && danger && !reason.trim() ? t("supervisor.rejectionReasonRequired") : undefined}
          />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedTransitionId(null); setReason("") }}>{t("common.cancel")}</Button>
            <Button variant={danger ? "danger" : warning ? "secondary" : "primary"} size="sm" loading={submitting} onClick={() => handleSubmit(transition)}>
              {i18n.language?.startsWith("en") ? transition.labelEn || transition.label : transition.label || transition.labelEn}
            </Button>
          </div>
        </div>
        )
      })()}

      <div>
        <h2 className="font-display text-lg text-iodine-brown mb-3">{t("supervisor.statusTimeline")}</h2>
        <div className="relative pl-6 border-l-2 border-graph-line space-y-5">
          {timeline.map((event, i) => (
            <div key={`${event.label}-${i}`} className="relative">
              <div
                className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 border-white ${
                  event.status === "success" ? "bg-antiseptic-green" :
                  event.status === "warning" ? "bg-warning-500" :
                  event.status === "danger" ? "bg-danger-500" : "bg-chart-gray"
                }`}
              />
              <p className="text-sm font-medium text-iodine-brown">{event.label}</p>
              <p className="text-xs text-chart-gray">{event.actor} · {new Date(event.timestamp).toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function normalizeStateId(workflow: WorkflowDefinition, state?: string) {
  if (!state) return workflow.states.find((candidate) => candidate.isInitial)?.id ?? workflow.states[0]?.id ?? "s-draft"
  return workflow.states.find((candidate) => candidate.id === state || candidate.key === state)?.id ?? state
}

function isRejectTransition(transition: WorkflowTransition) {
  return `${transition.key} ${transition.label} ${transition.labelEn} ${transition.toState}`.toLowerCase().includes("reject")
}

function isReturnTransition(transition: WorkflowTransition) {
  const text = `${transition.key} ${transition.label} ${transition.labelEn} ${transition.toState}`.toLowerCase()
  return text.includes("return") || text.includes("changes") || text.includes("draft")
}

function statusForTransition(transition: WorkflowTransition) {
  const text = `${transition.key} ${transition.label} ${transition.labelEn} ${transition.toState}`.toLowerCase()
  if (text.includes("reject")) return "rejected"
  if (text.includes("approve") || text.includes("verified") || text.includes("confirm") || text.includes("close")) return "approved"
  return "pending"
}

function reviewableTransitions(workflow: WorkflowDefinition, record: RecordData, role: string) {
  const current = normalizeStateId(workflow, record.state)
  return workflow.transitions.filter((transition) => {
    const from = normalizeStateId(workflow, transition.fromState)
    return from === current && hasAnyRoleAccess(role, transition.requiredRoles ?? [])
  })
}
