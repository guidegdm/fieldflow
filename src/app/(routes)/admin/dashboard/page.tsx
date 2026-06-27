"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { DEMO_USERS } from "@/types/auth"

export default function AdminDashboard() {
  const { t } = useTranslation()
  const [kpis, setKpis] = useState({ workflows: 0, records: 0, online: 0, conflicts: 0 })
  const [workflows, setWorkflows] = useState<Array<{name: string; version: number; status: string; count: number}>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [recordsRes, workflowsRes] = await Promise.all([
          fetch("/api/workflows/wf-1/records", { credentials: "include" }).then(r => r.json()),
          fetch("/api/workflows/wf-1/definition", { credentials: "include" }).then(r => r.json()),
        ])
        const records = recordsRes.records || []
        const wf = workflowsRes
        const conflicts = (await fetch("/api/sync/conflict", { method: "GET", credentials: "include" }).then(r => r.json()).catch(() => ({})))
        setKpis({
          workflows: 1,
          records: records.length,
          online: 4,
          conflicts: Object.keys(conflicts).length || 0,
        })
        if (wf.id) {
          setWorkflows([{ name: wf.name || wf.nameEn || "Workflow", version: wf.version || 1, status: wf.status || "published", count: records.length }])
        }
      } catch {
        setKpis({ workflows: 1, records: 2, online: 4, conflicts: 0 })
        setWorkflows([{ name: "Enregistrement et Distribution Humanitaire", version: 2, status: "published", count: 2 }])
      }
      setLoading(false)
    }
    load()
  }, [])

  const activity = [
    { time: "09:32", actor: "Céline M.", action: "a publié Distribution Humanitaire v3", color: "bg-clay" },
    { time: "09:15", actor: "Dr. Amara", action: "a approuvé 12 enregistrements", color: "bg-antiseptic-green" },
    { time: "08:47", actor: "Jean-Pierre", action: "a soumis 8 nouveaux ménages", color: "bg-scrub-blue" },
    { time: "08:12", actor: "Fatima", action: "a signalé un conflit de données", color: "bg-warning-500" },
  ]

  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-bold text-ink-black">{t("admin.title", "Tableau de bord")}</h1>
      <p className="mt-1 text-sm text-pencil">{t("admin.subtitle", "Vue d'ensemble de votre organisation")}</p>

      <div className="mt-8 grid grid-cols-4 gap-4">
        {[
          { label: "workflows", value: kpis.workflows, sub: "actifs" },
          { label: "records", value: kpis.records, sub: "enregistrements" },
          { label: "online", value: kpis.online, sub: "en ligne" },
          { label: "conflicts", value: kpis.conflicts, sub: "conflits" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-graph-line bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-pencil">{t(`admin.kpi.${k.label}`, k.label)}</p>
            <p className="mt-1 font-display text-3xl font-bold text-ink-black">{loading ? "—" : k.value}</p>
            <p className="mt-1 text-xs text-pencil">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-lg border border-graph-line bg-white p-6">
          <h2 className="font-medium text-ink-black">{t("admin.recentActivity", "Activité récente")}</h2>
          <div className="mt-4 space-y-3">
            {activity.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 rounded-full ${a.color}`} />
                <div>
                  <span className="font-mono text-xs text-pencil">{a.time}</span>
                  <span className="ml-2 text-xs font-medium">{a.actor}</span>
                  <p className="text-sm text-ink-black">{a.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-graph-line bg-white p-6">
            <h2 className="font-medium text-ink-black">{t("admin.syncHealth", "Santé de la synchronisation")}</h2>
            <div className="mt-4 space-y-2">
              {DEMO_USERS.map((u) => (
                <div key={u.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-antiseptic-green" />
                    <span className="font-mono text-xs">{u.deviceId}</span>
                  </div>
                  <span className="text-xs text-pencil">{u.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-graph-line bg-white p-6">
            <h2 className="font-medium text-ink-black">{t("admin.workflows", "Workflows")}</h2>
            <div className="mt-4 space-y-3">
              {workflows.map((wf) => (
                <div key={wf.name} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink-black">{wf.name}</p>
                    <p className="text-xs text-pencil">v{wf.version} · {wf.count} recs</p>
                  </div>
                  <Badge variant={wf.status === "published" ? "success" : "warning"}>{wf.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
