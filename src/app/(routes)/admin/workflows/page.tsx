"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { ChevronRight, Workflow as WorkflowIcon, Plus } from "lucide-react"
import type { WorkflowDefinition } from "@/types/workflow"

type Row = {
  id: string
  name: string
  version: number
  status: string
  recordCount: number
  updatedAt: string
}

const FALLBACK: Row[] = [
  { id: "wf-1", name: "Enregistrement et Distribution Humanitaire", version: 3, status: "published", recordCount: 12, updatedAt: "2026-06-25T14:30:00Z" },
]

export default function AdminWorkflowsIndex() {
  const { t } = useTranslation()
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    async function load() {
      try {
        const { db } = await import("@/lib/db/indexeddb")
        const all = await db.getAllWorkflows()
        if (all.length > 0) {
          setRows(
            all.map((w: WorkflowDefinition) => ({
              id: w.id,
              name: w.name,
              version: w.version,
              status: w.status ?? "published",
              recordCount: 0,
              updatedAt: w.updatedAt,
            })),
          )
        } else {
          setRows(FALLBACK)
        }
      } catch {
        setRows(FALLBACK)
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WorkflowIcon size={22} className="text-lake-deep" />
          <h1 className="font-display text-4xl text-lake-deep tracking-tight">{t("admin.workflows")}</h1>
        </div>
        <Button variant="primary" onClick={() => router.push("/admin/workflows/new")}>
          <Plus size={16} />
          {t("admin.newWorkflow")}
        </Button>
      </div>

      <div className="border-2 border-volcanic-ash">
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
                    <span className="font-mono text-xs bg-gray-100 text-chart-gray px-2 py-0.5 rounded-full">
                      v{wf.version}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={wf.status === "published" ? "success" : "default"} size="sm">
                      {wf.status === "published" ? t("workflow.published") : t("workflow.draft")}
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
                    <ChevronRight size={16} className="text-volcanic-ash" />
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
