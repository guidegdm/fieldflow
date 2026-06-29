"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { apiGet, apiPost } from "@/lib/api/client"
import { ConflictMerge, type ConflictField } from "@/components/conflicts/ConflictMerge"
import type { ConflictRecord } from "@/types/sync"
import { useAuthStore } from "@/stores/authStore"
import { useWorkflowContext } from "@/hooks/useWorkflowContext"

export default function SupervisorConflicts() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { activeWorkflowId } = useWorkflowContext()
  const [conflictFields, setConflictFields] = useState<ConflictField[]>([])
  const [loading, setLoading] = useState(true)
  const [recordId, setRecordId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      let records: ConflictRecord[] = []
      try {
        records = await apiGet<ConflictRecord[]>("/api/sync/conflict")
      } catch { /* API not available */ }
      if (records.length === 0) {
        try {
          const { db } = await import("@/lib/db/indexeddb")
          records = await db.getConflicts()
        } catch { /* DB not ready */ }
      }
      let scopedRecordIds: Set<string> | null = null
      try {
        const { db } = await import("@/lib/db/indexeddb")
        const localRecords = user?.orgId ? await db.getAllRecordsForOrg(user.orgId) : await db.getAllRecords()
        scopedRecordIds = new Set(localRecords.filter((record) => !activeWorkflowId || record.workflowId === activeWorkflowId).map((record) => record.id))
      } catch { /* DB not ready */ }
      const open = records.filter(c => c.status === "OPEN" && (!scopedRecordIds || scopedRecordIds.has(c.record_id)))
      if (cancelled) return
      if (open.length > 0) {
        setRecordId(open[0].record_id)
        setConflictFields(open.map(c => ({
          key: c.field,
          label: c.field.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          local: String(c.value_a ?? ""),
          remote: String(c.value_b ?? ""),
          autoResolved: false,
        })))
      } else {
        setRecordId(null)
        setConflictFields([])
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [activeWorkflowId, user?.orgId])

  const handleResolve = useCallback(async (resolutions: Record<string, { choice: string; value: string }>, rationale: string) => {
    await apiPost("/api/sync/conflict", {
      record_id: recordId,
      resolutions,
      rationale,
      resolved_by: "supervisor",
    })
  }, [recordId])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-9 w-48 bg-graph-line rounded" />
        <div className="h-4 w-32 bg-graph-line rounded mt-3" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-graph-line rounded-lg" />
          <div className="h-48 bg-graph-line rounded-lg" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 bg-graph-line rounded-lg" />
          <div className="h-10 w-28 bg-graph-line rounded-lg" />
          <div className="h-10 w-36 bg-graph-line rounded-lg" />
        </div>
        <div className="h-24 bg-graph-line rounded-lg" />
      </div>
    )
  }

  if (conflictFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-14 h-14 rounded-full bg-warning-500/10 flex items-center justify-center">
          <AlertTriangle size={32} className="text-warning-500" />
        </div>
        <h2 className="font-display text-2xl text-iodine-brown">{t("conflicts.none")}</h2>
        <Button variant="secondary" onClick={() => window.location.href = "/supervisor/dashboard"}>
          {t("common.back")}
        </Button>
      </div>
    )
  }

  return (
    <Card className="border-graph-line">
      <div className="p-6 pt-6">
        <ConflictMerge
          fields={conflictFields}
          recordId={recordId ?? undefined}
          onResolve={handleResolve}
        />
      </div>
    </Card>
  )
}
