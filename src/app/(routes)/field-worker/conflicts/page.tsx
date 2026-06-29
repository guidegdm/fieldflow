"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { apiPost } from "@/lib/api/client"
import { ConflictMerge, type ConflictField } from "@/components/conflicts/ConflictMerge"
import type { ConflictRecord } from "@/types/sync"
import Link from "next/link"
import { useAuthStore } from "@/stores/authStore"
import { useWorkflowContext } from "@/hooks/useWorkflowContext"

export default function FieldWorkerConflicts() {
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
      try {
        const { db } = await import("@/lib/db/indexeddb")
        const [conflicts, records] = await Promise.all([
          db.getConflicts(),
          user?.orgId ? db.getAllRecordsForOrg(user.orgId) : db.getAllRecords(),
        ])
        if (cancelled) return
        const recordIds = new Set(records.filter((record) => !activeWorkflowId || record.workflowId === activeWorkflowId).map((record) => record.id))
        const open: ConflictRecord[] = conflicts.filter(c => c.status === "OPEN" && recordIds.has(c.record_id))
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
      } catch { /* DB not ready */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [activeWorkflowId, user?.orgId])

  const handleResolve = useCallback(async (resolutions: Record<string, { choice: string; value: string }>, rationale: string) => {
    try {
      await apiPost("/api/sync/conflict", {
        record_id: recordId,
        resolutions,
        rationale,
        resolved_by: "field_worker",
      })
    } catch {
      const { db } = await import("@/lib/db/indexeddb")
      for (const [field, res] of Object.entries(resolutions)) {
        const conflicts: ConflictRecord[] = await db.getConflicts()
        const conflict = conflicts.find(c => c.field === field && c.record_id === recordId && c.status === "OPEN")
        if (conflict) {
          const resolution = res.choice === "yours" ? "accept_a" as const : res.choice === "remote" ? "accept_b" as const : "manual" as const
          await db.resolveConflict(conflict.id, resolution, res.value, rationale)
        }
      }
    }
  }, [recordId])

  if (loading) {
    return (
      <div className="py-4 space-y-6 animate-pulse">
        <div className="h-5 w-32 bg-graph-line rounded" />
        <div className="h-9 w-48 bg-graph-line rounded mt-1" />
        <div className="h-4 w-24 bg-graph-line rounded mt-2" />
      </div>
    )
  }

  if (conflictFields.length === 0) {
    return (
      <div className="py-4 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/field-worker/home" className="text-sm text-scrub-blue hover:underline">
            ← {t("common.back")}
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-14 h-14 rounded-full bg-antiseptic-green/10 flex items-center justify-center">
            <AlertTriangle size={32} className="text-antiseptic-green" />
          </div>
          <h2 className="font-display text-2xl text-iodine-brown">{t("conflicts.none")}</h2>
          <Button variant="secondary" onClick={() => window.location.href = "/field-worker/home"}>
            {t("common.back")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="py-4 space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/field-worker/home" className="text-sm text-scrub-blue hover:underline flex items-center gap-1">
          <ChevronRight size={14} className="rotate-180" />
          {t("common.back")}
        </Link>
      </div>
      <Card className="border-graph-line">
        <div className="p-6 pt-6">
          <ConflictMerge
            fields={conflictFields}
            recordId={recordId ?? undefined}
            onResolve={handleResolve}
          />
        </div>
      </Card>
    </div>
  )
}
