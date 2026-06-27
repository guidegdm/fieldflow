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

type ReviewAction = "approve" | "reject" | "changes"
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
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [record, setRecord] = useState<RecordData | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<ReviewAction | null>(null)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const id = searchParams.get("id")
    fetch("/api/workflows/wf-1/records", { credentials: "include" })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        const records = Array.isArray(data) ? data as RecordData[] : []
        setRecord(id ? records.find((r) => r.id === id) ?? null : records[0] ?? null)
      })
      .catch(() => setRecord(null))
      .finally(() => setLoading(false))
  }, [searchParams])

  const timeline = useMemo(() => record ? buildTimeline(record) : [], [record])

  const handleSubmit = async () => {
    if (!record || !action) return
    if ((action === "reject" || action === "changes") && !reason.trim()) return

    const now = Date.now()
    const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "changes_requested"
    const state = action === "approve" ? "s-approved" : action === "reject" ? "s-rejected" : "s-submitted"
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
  const members = fieldValue(record, ["household_size", "size"])
  const village = fieldValue(record, ["village"])

  return (
    <div className="max-w-3xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-chart-gray hover:text-iodine-brown transition-colors">
        <ArrowLeft size={16} />
        {t("common.back")}
      </button>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-iodine-brown tracking-tight">{head}</h1>
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
          {[
            { label: t("records.headOfHousehold"), value: head },
            { label: t("records.householdSize"), value: members },
            { label: t("records.village"), value: village },
          ].map((f) => (
            <div key={f.label} className="flex items-baseline gap-4 text-sm">
              <span className="text-chart-gray min-w-[10rem] text-right uppercase tracking-wider text-[11px]">{f.label}</span>
              <span className="border-b border-dotted border-graph-line flex-1" />
              <span className="text-iodine-brown font-medium">{f.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          className={`${action === "approve" ? "ring-2 ring-antiseptic-green" : ""} bg-antiseptic-green hover:bg-antiseptic-green/90`}
          onClick={() => setAction(action === "approve" ? null : "approve")}
        >
          <ShieldCheck size={16} />
          {t("supervisor.approve")}
        </Button>
        <Button
          variant="danger"
          className={`${action === "reject" ? "ring-2 ring-danger-500" : ""}`}
          onClick={() => setAction(action === "reject" ? null : "reject")}
        >
          <ShieldX size={16} />
          {t("supervisor.reject")}
        </Button>
        <Button
          variant="secondary"
          className={`border-warning-500 text-warning-500 hover:bg-warning-500/5 ${action === "changes" ? "ring-2 ring-warning-500" : ""}`}
          onClick={() => setAction(action === "changes" ? null : "changes")}
        >
          <AlertTriangle size={16} />
          {t("supervisor.requestChanges")}
        </Button>
      </div>

      {(action === "reject" || action === "changes") && (
        <div className={`space-y-3 p-4 rounded-md border ${action === "reject" ? "border-danger-500/30 bg-danger-500/5" : "border-warning-500/30 bg-warning-500/5"}`}>
          <Textarea
            label={t("supervisor.rejectionReason")}
            placeholder={action === "reject" ? t("supervisor.rejectionReasonRequired") : t("supervisor.requestChanges")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={submitting && !reason.trim() ? t("supervisor.rejectionReasonRequired") : undefined}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAction(null); setReason("") }}>{t("common.cancel")}</Button>
            <Button variant={action === "reject" ? "danger" : "secondary"} size="sm" loading={submitting} onClick={handleSubmit}>
              {action === "reject" ? t("supervisor.confirmRejection") : t("supervisor.requestChanges")}
            </Button>
          </div>
        </div>
      )}

      {action === "approve" && (
        <div className="flex justify-end gap-2 p-4 rounded-md border border-antiseptic-green/30 bg-antiseptic-green/5">
          <Button variant="ghost" size="sm" onClick={() => setAction(null)}>{t("common.cancel")}</Button>
          <Button className="bg-antiseptic-green hover:bg-antiseptic-green/90" size="sm" loading={submitting} onClick={handleSubmit}>
            {t("supervisor.confirmApproval")}
          </Button>
        </div>
      )}

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
