"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { UserRole } from "@/types/auth"

interface UserRow {
  id: string
  name: string
  email: string
  role: UserRole
}

export default function AdminDashboard() {
  const { t } = useTranslation()
  const [data, setData] = useState({ workflows: 1, records: 0, users: 4, conflicts: 0 })
  const [workflows, setWorkflows] = useState<{ name: string; version: number; status: string; count: number }[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, workflowsRes, usersRes] = await Promise.all([
          fetch("/api/admin/stats", { credentials: "include" }).then(r => r.json()),
          fetch("/api/workflows", { credentials: "include" }).then(r => r.json()),
          fetch("/api/admin/users", { credentials: "include" }).then(r => r.ok ? r.json() : []),
        ])
        setData({ workflows: statsRes.workflows ?? 0, records: statsRes.records ?? 0, users: usersRes.length, conflicts: statsRes.conflicts ?? 0 })
        setUsers(usersRes)
        setWorkflows(workflowsRes.map((wf: { name: string; version: number; status: string; recordCount?: number }) => ({
          name: wf.name,
          version: wf.version,
          status: wf.status,
          count: wf.recordCount ?? 0,
        })))
      } catch {
        setWorkflows([])
        setUsers([])
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-ink-black">{t("admin.title", "Tableau de bord")}</h1>
      <p className="mt-1 text-sm text-pencil">{t("admin.subtitle", "Vue d'ensemble de votre organisation")}</p>

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Workflows", value: loading ? "—" : data.workflows, sub: "actifs" },
          { label: "Enregistrements", value: loading ? "—" : data.records, sub: "total" },
          { label: "Utilisateurs", value: loading ? "—" : data.users, sub: "actifs" },
          { label: "Conflits", value: loading ? "—" : data.conflicts, sub: "à résoudre" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-graph-line bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-pencil">{k.label}</p>
            <p className="mt-1 font-display text-3xl font-bold text-ink-black">{k.value}</p>
            <p className="mt-1 text-xs text-pencil">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg border border-graph-line bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-ink-black">{t("admin.workflows", "Workflows")}</h2>
            <Link href="/admin/workflows/new" className="rounded-md bg-ink-blue text-white px-4 py-2 text-sm font-medium hover:bg-ink-blue/90">+ Nouveau</Link>
          </div>
          {workflows.map((wf) => (
            <Link key={wf.name} href="/admin/workflows/wf-1" className="flex items-center justify-between py-3 border-b border-graph-line last:border-0 hover:bg-graph-paper -mx-2 px-2 rounded">
              <div>
                <p className="text-sm font-medium text-ink-black">{wf.name}</p>
                <p className="text-xs text-pencil">v{wf.version} · {wf.count} enregistrements</p>
              </div>
              <Badge variant={wf.status === "published" ? "success" : "warning"}>{wf.status === "published" ? "Publié" : "Brouillon"}</Badge>
            </Link>
          ))}
        </div>

        <div className="rounded-lg border border-graph-line bg-white p-6">
          <h2 className="font-medium text-ink-black mb-4">{t("admin.users", "Utilisateurs")}</h2>
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-clay flex items-center justify-center text-white text-xs font-semibold shrink-0">{u.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-black truncate">{u.name}</p>
                  <p className="text-xs text-pencil">{u.email}</p>
                </div>
                <Badge variant="info">{u.role === "org_admin" ? "Admin" : u.role === "supervisor" ? "Superviseur" : "Agent"}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
