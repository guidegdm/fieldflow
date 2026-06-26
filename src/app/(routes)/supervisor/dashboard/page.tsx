"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Inbox, CheckCircle2, XCircle, AlertTriangle, Clock, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

type ReviewRecord = {
  id: string
  name: string
  submitter: string
  status: "pending_sync" | "approved" | "rejected" | "in_conflict"
  time: number
}

const MOCK_NOW = 1750000000000

const mockRecords: ReviewRecord[] = [
  { id: "rec-3", name: "Bahati Zawadi", submitter: "Jean-Pierre", status: "pending_sync", time: MOCK_NOW - 1800000 },
  { id: "rec-4", name: "Muhindo Salima", submitter: "Fatima", status: "pending_sync", time: MOCK_NOW - 3600000 },
  { id: "rec-5", name: "Kavira Bahati", submitter: "Jean-Pierre", status: "in_conflict", time: MOCK_NOW - 7200000 },
  { id: "rec-6", name: "Ruganza Baraka", submitter: "Fatima", status: "pending_sync", time: MOCK_NOW - 10800000 },
]

const statusConfig: Record<string, { variant: "warning" | "success" | "danger" | "info"; label: string }> = {
  pending_sync: { variant: "warning", label: "dashboard.pending" },
  approved: { variant: "success", label: "dashboard.approvedToday" },
  rejected: { variant: "danger", label: "dashboard.rejected" },
  in_conflict: { variant: "info", label: "dashboard.conflicts" },
}

export default function SupervisorDashboard() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState("all")
  const [records] = useState(mockRecords)

  const filtered = records.filter((r) => {
    if (filter === "priority") return r.status === "in_conflict"
    if (filter === "today") return r.time > MOCK_NOW - 86400000
    return true
  })

  const stats = [
    { label: t("dashboard.pending"), count: records.filter((r) => r.status === "pending_sync").length, icon: Clock, color: "text-warning-500", bg: "bg-warning-500/10" },
    { label: t("dashboard.approvedToday"), count: 2, icon: CheckCircle2, color: "text-antiseptic-green", bg: "bg-antiseptic-green/10" },
    { label: t("dashboard.rejected"), count: 1, icon: XCircle, color: "text-danger-500", bg: "bg-danger-500/10" },
    { label: t("dashboard.conflicts"), count: records.filter((r) => r.status === "in_conflict").length, icon: AlertTriangle, color: "text-scrub-blue", bg: "bg-scrub-blue/10" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-iodine-brown tracking-tight">{t("dashboard.supervisor")}</h1>
        <p className="text-sm text-chart-gray mt-1">{t("dashboard.pendingReviews")} · {records.length} {t("dashboard.pending")}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border-graph-line">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${stat.bg}`}>
                  <Icon size={20} className={stat.color} />
                </div>
                <div>
                  <p className="text-2xl font-display font-semibold text-iodine-brown">{stat.count}</p>
                  <p className="text-xs text-chart-gray">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex items-center gap-2 pb-2 border-b border-graph-line">
        {["all", "priority", "today"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
              filter === f ? "bg-scrub-blue text-white" : "text-chart-gray hover:text-iodine-brown hover:bg-gray-100"
            }`}
          >
            {t(`dashboard.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-chart-gray">
            <Inbox size={40} className="mb-3 opacity-40" />
            <p className="text-sm">{t("dashboard.noPending")}</p>
          </div>
        ) : (
          filtered.map((record) => {
            const cfg = statusConfig[record.status]
            return (
              <div
                key={record.id}
                className="flex items-center gap-4 px-4 py-3 rounded-md bg-white border border-graph-line hover:border-chart-gray/40 transition-colors"
              >
                <Badge variant={cfg.variant} size="sm" className="-rotate-1 border shadow-sm shrink-0">
                  {t(cfg.label)}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-iodine-brown truncate">{record.name}</p>
                  <p className="text-xs text-chart-gray">
                    {t("dashboard.submitter")} {record.submitter} · {t("dashboard.timeAgo")} {Math.floor((MOCK_NOW - record.time) / 3600000)}h
                  </p>
                </div>
                <Link href={`/supervisor/review?id=${record.id}`}>
                  <Button variant="secondary" size="sm">
                    {t("supervisor.review")}
                    <ChevronRight size={14} />
                  </Button>
                </Link>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
