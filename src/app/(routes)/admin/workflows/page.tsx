"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Archive, ChevronRight, Loader2, Workflow as WorkflowIcon, Plus } from "lucide-react"
import { db } from "@/lib/db/indexeddb"
import { useAuthStore } from "@/stores/authStore"
import type { WorkflowDefinition } from "@/types/workflow"
import { invalidate, onInvalidation } from "@/lib/invalidation"

type Row = {
  id: string
  name: string
  version: number
  status: WorkflowDefinition["status"]
  recordCount: number
  updatedAt: string
}

export default function AdminWorkflowsIndex() {
  const { t } = useTranslation()
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [archivingId, setArchivingId] = useState<string | null>(null)

  const loadRows = useCallback(async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/workflows", { credentials: "include" })
        const all = res.ok ? await res.json() : user?.orgId ? await db.getAllWorkflowsForOrg(user.orgId) : []
        if (res.ok && user?.orgId) await db.replaceWorkflowsForOrg(user.orgId, all).catch(() => {})
        setRows(
          all.map((w: WorkflowDefinition & { recordCount?: number }) => ({
            id: w.id,
            name: w.name,
            version: w.version,
            status: w.status ?? "published",
            recordCount: w.recordCount ?? 0,
            updatedAt: w.updatedAt,
          })),
        )
      } catch {
        const local = user?.orgId ? await db.getAllWorkflowsForOrg(user.orgId).catch(() => []) : []
        setRows(
          local.map((w: WorkflowDefinition & { recordCount?: number }) => ({
            id: w.id,
            name: w.name,
            version: w.version,
            status: w.status ?? "published",
            recordCount: w.recordCount ?? 0,
            updatedAt: w.updatedAt,
          })),
        )
      }
      setLoading(false)
  }, [user?.orgId])

  const archiveWorkflow = async (workflowId: string) => {
    const confirmed = window.confirm(t("admin.archiveWorkflowConfirm", "Archive this workflow? Existing records stay available, but workers will no longer use it for new entries."))
    if (!confirmed) return
    setArchivingId(workflowId)
    const previous = rows
    setRows((current) => current.map((row) => row.id === workflowId ? { ...row, status: "archived" } : row))
    try {
      const res = await fetch(`/api/workflows/${workflowId}/definition`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) throw new Error("archive_failed")
      const archived = await res.json()
      setRows((current) => current.map((row) => row.id === workflowId ? { ...row, status: archived.status ?? "archived", updatedAt: archived.updatedAt ?? row.updatedAt } : row))
      await db.saveWorkflow(archived).catch(() => {})
      invalidate(["workflows", "sync"])
    } catch {
      setRows(previous)
    } finally {
      setArchivingId(null)
    }
  }

  const statusLabel = (status: WorkflowDefinition["status"]) => {
    if (status === "published") return t("workflow.published")
    if (status === "archived") return t("workflow.archived", "Archived")
    return t("workflow.draft")
  }

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    return onInvalidation(["workflows", "sync"], () => {
      void loadRows()
    })
  }, [loadRows])

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <WorkflowIcon size={22} className="text-lake-deep" />
          <h1 className="font-display text-4xl text-lake-deep tracking-tight">{t("admin.workflows")}</h1>
        </div>
        <Button variant="primary" onClick={() => router.push("/admin/workflows/new")} className="w-full sm:w-auto">
          <Plus size={16} />
          {t("admin.newWorkflow")}
        </Button>
      </div>

      <div className="max-w-full overflow-x-auto border-2 border-volcanic-ash">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-volcanic-ash">
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.name")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.version")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("records.status")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.recordCount")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.lastModified")}</TableHead>
              <TableHead className="bg-kivu-paper w-10" aria-label="" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2].map((i) => (
                <TableRow key={i} className="border-b-2 border-volcanic-ash">
                  <TableCell colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="border-b-2 border-volcanic-ash">
                <TableCell colSpan={6} className="text-center py-8 text-pencil">
                  {t("admin.noWorkflows")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((wf) => (
                <TableRow
                  key={wf.id}
                  className="border-b-2 border-volcanic-ash hover:bg-kivu-paper cursor-pointer"
                  onClick={() => router.push(`/admin/workflows/${wf.id}`)}
                >
                  <TableCell className="font-medium text-ink-black">{wf.name}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-graph-paper text-chart-gray px-2 py-0.5 rounded-full">
                      v{wf.version}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={wf.status === "published" ? "success" : wf.status === "archived" ? "default" : "warning"} size="sm">
                      {statusLabel(wf.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-pencil">{wf.recordCount}</TableCell>
                  <TableCell className="text-pencil text-xs">
                    {new Date(wf.updatedAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {wf.status !== "archived" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            void archiveWorkflow(wf.id)
                          }}
                          disabled={archivingId === wf.id}
                          title={t("admin.archiveWorkflow", "Archive workflow")}
                        >
                          {archivingId === wf.id ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                          <span className="sr-only">{t("admin.archiveWorkflow", "Archive workflow")}</span>
                        </Button>
                      )}
                      <ChevronRight size={16} className="mt-2 text-volcanic-ash" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
