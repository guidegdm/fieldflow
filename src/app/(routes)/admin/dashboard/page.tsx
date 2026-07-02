"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { UserRole } from "@/types/auth"
import { db } from "@/lib/db/indexeddb"
import { loadOfflineDemoSandbox } from "@/lib/demo/offline-demo-cache"
import { useAuthStore } from "@/stores/authStore"

interface UserRow {
  id: string
  name: string
  email: string
  role: UserRole
}

interface WorkflowRow {
  id: string
  name: string
  version: number
  status: string
  count: number
}

export default function AdminDashboard() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const [data, setData] = useState({ workflows: 1, records: 0, users: 4, conflicts: 0 })
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadLocal(orgId: string) {
      const [localWorkflows, localRecords, localConflicts, cachedUsers] = await Promise.all([
        db.getAllWorkflowsForOrg(orgId).catch(() => []),
        db.getAllRecordsForOrg(orgId).catch(() => []),
        db.getConflicts(orgId).catch(() => []),
        db.getProjection<UserRow[]>(`admin-users:${orgId}`).catch(() => undefined),
      ])
      if (cancelled) return
      const projectedUsers = cachedUsers?.length ? cachedUsers : loadOfflineDemoSandbox()?.accounts
        .filter((account) => account.org.id === orgId)
        .map((account) => ({
          id: account.user.id,
          name: account.user.name,
          email: account.user.email,
          role: account.user.role,
        })) ?? []
      setWorkflows(localWorkflows.map((wf) => ({
        id: wf.id,
        name: wf.name,
        version: wf.version,
        status: wf.status,
        count: localRecords.filter((record) => record.workflowId === wf.id).length,
      })))
      setUsers(projectedUsers)
      setData({
        workflows: localWorkflows.filter((workflow) => workflow.status !== "archived").length,
        records: localRecords.length,
        users: projectedUsers.length,
        conflicts: localConflicts.filter((conflict) => conflict.status === "OPEN").length,
      })
      setLoading(false)
    }

    async function load() {
      const orgId = user?.orgId
      if (orgId) void loadLocal(orgId)
      try {
        const [statsRes, workflowsRes, usersRes] = await Promise.all([
          fetch("/api/admin/stats", { credentials: "include" }).then(r => r.json()),
          fetch("/api/workflows", { credentials: "include" }).then(r => r.json()),
          fetch("/api/admin/users", { credentials: "include" }).then(r => r.ok ? r.json() : []),
        ])
        if (cancelled) return
        setData({ workflows: statsRes.workflows ?? 0, records: statsRes.records ?? 0, users: usersRes.length, conflicts: statsRes.conflicts ?? 0 })
        setUsers(usersRes)
        if (orgId) void db.putProjection(`admin-users:${orgId}`, usersRes, orgId)
        setWorkflows((Array.isArray(workflowsRes) ? workflowsRes : []).map((wf: { id: string; name: string; version: number; status: string; recordCount?: number }) => ({
          id: wf.id,
          name: wf.name,
          version: wf.version,
          status: wf.status,
          count: wf.recordCount ?? 0,
        })))
      } catch {
        if (cancelled) return
        const orgId = user?.orgId
        const [localWorkflows, localRecords, localConflicts] = await Promise.all([
          orgId ? db.getAllWorkflowsForOrg(orgId).catch(() => []) : Promise.resolve([]),
          orgId ? db.getAllRecordsForOrg(orgId).catch(() => []) : Promise.resolve([]),
          orgId ? db.getConflicts(orgId).catch(() => []) : Promise.resolve([]),
        ])
        const offlineAccounts = loadOfflineDemoSandbox()?.accounts
          .filter((account) => account.org.id === orgId)
          .map((account) => ({
            id: account.user.id,
            name: account.user.name,
            email: account.user.email,
            role: account.user.role,
          })) ?? []
        setWorkflows(localWorkflows.map((wf) => ({
          id: wf.id,
          name: wf.name,
          version: wf.version,
          status: wf.status,
          count: localRecords.filter((record) => record.workflowId === wf.id).length,
        })))
        setUsers(offlineAccounts)
        setData({
          workflows: localWorkflows.filter((workflow) => workflow.status !== "archived").length,
          records: localRecords.length,
          users: offlineAccounts.length,
          conflicts: localConflicts.filter((conflict) => conflict.status === "OPEN").length,
        })
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user?.orgId])

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-ink-black">{t("admin.title", "Tableau de bord")}</h1>
      <p className="mt-1 text-sm text-pencil">{t("admin.subtitle", "Vue d'ensemble de votre organisation")}</p>

      <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("admin.kpiWorkflows"), value: loading ? "—" : data.workflows, sub: t("admin.active") },
          { label: t("admin.kpiRecords"), value: loading ? "—" : data.records, sub: t("admin.total") },
          { label: t("admin.users"), value: loading ? "—" : data.users, sub: t("admin.active") },
          { label: t("admin.kpiConflicts"), value: loading ? "—" : data.conflicts, sub: t("admin.toResolve") },
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
            <Link href="/admin/workflows/new" className="rounded-md bg-ink-blue text-white px-4 py-2 text-sm font-medium hover:bg-ink-blue/90">{t("admin.newWorkflow")}</Link>
          </div>
          {workflows.map((wf) => (
            <Link key={wf.id} href={`/admin/workflows/${wf.id}`} className="flex items-center justify-between py-3 border-b border-graph-line last:border-0 hover:bg-graph-paper -mx-2 px-2 rounded">
              <div>
                <p className="text-sm font-medium text-ink-black">{wf.name}</p>
                <p className="text-xs text-pencil">{t("admin.workflowRecordSummary", { version: wf.version, count: wf.count })}</p>
              </div>
              <Badge variant={wf.status === "published" ? "success" : wf.status === "archived" ? "default" : "warning"}>
                {wf.status === "published" ? t("workflow.published") : wf.status === "archived" ? t("workflow.archived", "Archived") : t("workflow.draft")}
              </Badge>
            </Link>
          ))}
          {!loading && workflows.length === 0 && (
            <p className="py-6 text-sm text-pencil">{t("admin.noWorkflows")}</p>
          )}
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
                <Badge variant="info">{t(`roles.${u.role}`)}</Badge>
              </div>
            ))}
            {!loading && users.length === 0 && (
              <p className="text-sm text-pencil">{t("admin.noUsers")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
