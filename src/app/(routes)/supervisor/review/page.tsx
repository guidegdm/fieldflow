"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { ShieldCheck, ShieldX, AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

const mockRecord = {
  id: "rec-3",
  head: "Bahati Zawadi",
  members: 6,
  village: "Kasenge",
  submitter: "Jean-Pierre",
  device: "device-a",
  status: "pending_sync" as const,
  timeline: [
    { label: "Créé", timestamp: Date.now() - 7200000, actor: "Jean-Pierre", status: "success" as const },
    { label: "Soumis", timestamp: Date.now() - 5400000, actor: "Jean-Pierre", status: "default" as const },
    { label: "En attente de vérification", timestamp: Date.now() - 3600000, actor: "Système", status: "warning" as const },
  ],
}

export default function SupervisorReview() {
  const { t } = useTranslation()
  const router = useRouter()
  const [record] = useState(mockRecord)
  const [action, setAction] = useState<"approve" | "reject" | "changes" | null>(null)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (action === "reject" && !reason.trim()) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 800))
    setSubmitting(false)
    router.push("/supervisor/dashboard")
  }

  return (
    <div className="max-w-3xl space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-chart-gray hover:text-iodine-brown transition-colors">
        <ArrowLeft size={16} />
        {t("common.back")}
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-iodine-brown tracking-tight">{record.head}</h1>
          <p className="text-sm text-chart-gray mt-1">
            {t("dashboard.submitter")} {record.submitter} · {record.device}
          </p>
        </div>
        <Badge variant="warning" size="md" className="-rotate-1 border shadow-sm shrink-0">
          {t("dashboard.pending")}
        </Badge>
      </div>

      <Card className="border-graph-line">
        <CardContent className="p-5 space-y-3">
          {[
            { label: t("records.headOfHousehold"), value: record.head },
            { label: t("records.householdSize"), value: String(record.members) },
            { label: t("records.village"), value: record.village },
          ].map((f) => (
            <div key={f.label} className="flex items-baseline gap-4 text-sm">
              <span className="text-chart-gray min-w-[10rem] text-right uppercase tracking-wider text-[11px]">{f.label}</span>
              <span className="border-b border-dotted border-graph-line flex-1" />
              <span className="text-iodine-brown font-medium">{f.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
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

      {action === "reject" && (
        <div className="space-y-3 p-4 rounded-md border border-danger-500/30 bg-danger-500/5">
          <Textarea
            label={t("supervisor.rejectionReason")}
            placeholder={t("supervisor.rejectionReasonRequired")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={submitting && !reason.trim() ? t("supervisor.rejectionReasonRequired") : undefined}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAction(null); setReason("") }}>{t("common.cancel")}</Button>
            <Button variant="danger" size="sm" loading={submitting} onClick={handleSubmit}>
              {t("supervisor.confirmRejection")}
            </Button>
          </div>
        </div>
      )}

      {action === "approve" && (
        <div className="flex justify-end gap-2 p-4 rounded-md border border-antiseptic-green/30 bg-antiseptic-green/5">
          <Button variant="ghost" size="sm" onClick={() => setAction(null)}>{t("common.cancel")}</Button>
          <Button
            className="bg-antiseptic-green hover:bg-antiseptic-green/90"
            size="sm"
            loading={submitting}
            onClick={handleSubmit}
          >
            {t("supervisor.confirmApproval")}
          </Button>
        </div>
      )}

      {action === "changes" && (
        <div className="space-y-3 p-4 rounded-md border border-warning-500/30 bg-warning-500/5">
          <Textarea
            label={t("supervisor.rejectionReason")}
            placeholder={t("supervisor.requestChanges")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAction(null); setReason("") }}>{t("common.cancel")}</Button>
            <Button variant="secondary" size="sm" className="border-warning-500 text-warning-500" loading={submitting} onClick={handleSubmit}>
              {t("supervisor.requestChanges")}
            </Button>
          </div>
        </div>
      )}

      <div>
        <h2 className="font-display text-lg text-iodine-brown mb-3">{t("supervisor.statusTimeline")}</h2>
        <div className="relative pl-6 border-l-2 border-graph-line space-y-5">
          {record.timeline.map((event, i) => (
            <div key={i} className="relative">
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
