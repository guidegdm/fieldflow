"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { DEMO_USERS } from "@/types/auth"

export default function AdminDashboard() {
  const { t } = useTranslation()
  const [kpis, setKpis] = useState([
    { label: "kpiWorkflows", value: "—", suffix: "" },
    { label: "kpiOnline", value: "—", suffix: "" },
    { label: "kpiRecords", value: "—", suffix: "" },
    { label: "kpiConflicts", value: "—", suffix: "" },
  ])
  const [workflows, setWorkflows] = useState<Array<{name: string; version: number; status: string; records: number}>>([])
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    async function load() {
      try {
        const { db } = await import("@/lib/db/indexeddb")
        const [allRecords, allWorkflows, conflicts] = await Promise.all([
          db.getAllRecords(),
          db.getAllWorkflows(),
          db.getConflicts(),
        ])
        setKpis([
          { label: "kpiWorkflows", value: String(allWorkflows.length), suffix: "" },
          { label: "kpiOnline", value: String(DEMO_USERS.length), suffix: "" },
          { label: "kpiRecords", value: String(allRecords.length), suffix: "" },
          { label: "kpiConflicts", value: String(conflicts.filter(c => c.status === "OPEN").length), suffix: "" },
        ])
        setWorkflows(allWorkflows.map(w => ({
          name: w.name,
          version: w.version,
          status: "published",
          records: allRecords.filter(r => r.workflowId === w.id).length,
        })))
      } catch { /* DB not ready */ }
    }
    load()
  }, [])

  // TODO: fetch activity feed from audit API
  const activity = [
    { time: "09:32", actor: "Céline M.", action: "a publié Distribution Humanitaire v3", color: "bg-clay" },
    { time: "09:15", actor: "Dr. Amara", action: "a approuvé 12 enregistrements", color: "bg-success-500" },
    { time: "08:47", actor: "Jean-Pierre", action: "a soumis 8 nouveaux ménages", color: "bg-info-500" },
    { time: "08:12", actor: "Fatima", action: "a signalé un conflit de données", color: "bg-warning-500" },
    { time: "07:55", actor: "Système", action: "synchronisation terminée (142 mutations)", color: "bg-success-500" },
    { time: "07:30", actor: "Céline M.", action: "a modifié le workflow Évaluation", color: "bg-clay" },
  ]

  // TODO: fetch real device statuses from heartbeat API
  const devices = DEMO_USERS.map(u => ({
    name: u.deviceId,
    user: u.name,
    status: "synced",
    lastSeen: "il y a 5 min",
    dot: "bg-success-500",
  }))

  return (
    <div className="max-w-6xl space-y-12">
      <h1 className="font-display text-4xl text-lake-deep tracking-tight">{t("dashboard.admin")}</h1>

      <section>
        <hr className="border-volcanic-ash/30 border-t-2 mb-6" />
        <div className="grid grid-cols-4">
          {kpis.map((kpi, i) => (
            <div key={kpi.label} className={i > 0 ? "border-l border-volcanic-ash/20 pl-8" : "pr-8"}>
              <p className="font-display text-5xl text-lake-deep tracking-tight leading-none">
                {kpi.value}{kpi.suffix}
              </p>
              <p className="text-[11px] uppercase tracking-[0.15em] text-soil mt-2">
                {t(`admin.${kpi.label}`)}
              </p>
            </div>
          ))}
        </div>
        <hr className="border-volcanic-ash/30 border-t-2 mt-6" />
      </section>

      <section className="grid grid-cols-5 gap-10">
        <div className="col-span-3 space-y-5">
          <h2 className="font-display text-2xl text-lake-deep tracking-tight">{t("admin.activityFeed")}</h2>
          <div className="relative pl-6">
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-volcanic-ash/20" />
            <div className="space-y-5">
              {activity.map((event, i) => (
                <div key={i} className="relative flex items-start gap-4">
                  <div className={`absolute -left-[19px] mt-1.5 h-3 w-3 rounded-full border-2 border-kivu-paper ${event.color}`} />
                  <span className="font-mono text-xs text-volcanic-ash whitespace-nowrap min-w-[3rem]">{event.time}</span>
                  <span className="text-sm text-soil">
                    <strong className="font-medium text-ink-black">{event.actor}</strong>{" "}
                    {event.action}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-5">
          <h2 className="font-display text-2xl text-lake-deep tracking-tight">{t("admin.syncHealth")}</h2>
          <div className="space-y-3">
            {devices.map((device) => (
              <div key={device.name} className="flex items-center justify-between py-2 border-b border-volcanic-ash/10">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${device.dot}`} />
                  <div>
                    <span className="font-mono text-sm text-ink-black">{device.name}</span>
                    <span className="block text-xs text-volcanic-ash">{device.user}</span>
                  </div>
                </div>
                <span className="text-xs text-volcanic-ash">{device.lastSeen}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="font-display text-2xl text-lake-deep tracking-tight">{t("admin.workflows")}</h2>
        <div className="border-2 border-volcanic-ash">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-volcanic-ash">
                <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.name")}</TableHead>
                <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.version")}</TableHead>
                <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("records.status")}</TableHead>
                <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold text-right">{t("admin.recordCount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((wf) => (
                <TableRow key={wf.name} className="border-b-2 border-volcanic-ash hover:bg-kivu-paper">
                  <TableCell className="font-medium text-ink-black">{wf.name}</TableCell>
                  <TableCell className="font-mono text-volcanic-ash">v{wf.version}</TableCell>
                  <TableCell>
                    <Badge variant={wf.status === "published" ? "success" : "default"} size="sm">
                      {wf.status === "published" ? t("workflow.published") : t("workflow.draft")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-display text-lg text-lake-deep text-right">{wf.records.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}
