"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { ChevronRight, Workflow as WorkflowIcon } from "lucide-react"
import type { WorkflowDefinition } from "@/types/workflow"

type Row = { id: string; name: string; version: number; states: number; fields: number; status: string }

const FALLBACK: Row[] = [
  { id: "wf-1", name: "Enregistrement et Distribution Humanitaire", version: 3, states: 5, fields: 8, status: "published" },
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
              states: w.states.length,
              fields: w.entity.fields.length,
              status: w.status ?? "published",
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
      <div className="flex items-center gap-3">
        <WorkflowIcon size={22} className="text-lake-deep" />
        <h1 className="font-display text-4xl text-lake-deep tracking-tight">{t("admin.workflows")}</h1>
      </div>

      <div className="border-2 border-volcanic-ash">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-volcanic-ash">
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.name")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.version")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("workflow.states")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("workflow.fields")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("records.status")}</TableHead>
              <TableHead className="bg-kivu-paper w-10" aria-label="" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2].map((i) => (
                <TableRow key={i} className="border-b-2 border-volcanic-ash">
                  <TableCell colSpan={6}>
                    <div className="h-5 bg-kivu-paper animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              rows.map((wf) => (
                <TableRow
                  key={wf.id}
                  className="border-b-2 border-volcanic-ash hover:bg-kivu-paper cursor-pointer"
                  onClick={() => router.push(`/admin/workflows/${wf.id}`)}
                >
                  <TableCell className="font-medium text-ink-black">{wf.name}</TableCell>
                  <TableCell className="font-mono text-volcanic-ash">v{wf.version}</TableCell>
                  <TableCell className="font-mono text-volcanic-ash">{wf.states}</TableCell>
                  <TableCell className="font-mono text-volcanic-ash">{wf.fields}</TableCell>
                  <TableCell>
                    <Badge variant={wf.status === "published" ? "success" : "default"} size="sm">
                      {wf.status === "published" ? t("workflow.published") : t("workflow.draft")}
                    </Badge>
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
