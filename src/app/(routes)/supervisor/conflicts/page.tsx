"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2, AlertTriangle, GitMerge } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { apiGet } from "@/lib/api/client"
import type { ConflictRecord } from "@/types/sync"

type ConflictField = {
  key: string
  label: string
  valueA: string
  valueB: string
  conflicting: boolean
}

export default function SupervisorConflicts() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<"a" | "b" | "manual" | null>(null)
  const [rationale, setRationale] = useState("")
  const [resolved, setResolved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [conflictFields, setConflictFields] = useState<ConflictField[]>([])
  const [loading, setLoading] = useState(true)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
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
      const open = records.filter(c => c.status === "OPEN")
      if (open.length > 0) {
        const grouped: Record<string, typeof open> = {}
        for (const c of open) {
          if (!grouped[c.record_id]) grouped[c.record_id] = []
          grouped[c.record_id].push(c)
        }
        const group = Object.values(grouped)[0]
        setConflictFields(group.map(c => ({
          key: c.field,
          label: c.field,
          valueA: String(c.value_a ?? ""),
          valueB: String(c.value_b ?? ""),
          conflicting: true,
        })))
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleResolve = async () => {
    if (!selected) return
    if (!rationale.trim()) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 1000))
    setResolved(true)
    setSubmitting(false)
  }

  if (resolved) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-14 h-14 rounded-full bg-antiseptic-green/10 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-antiseptic-green" />
        </div>
        <h2 className="font-display text-2xl text-iodine-brown">{t("conflicts.resolved")}</h2>
        <p className="text-sm text-chart-gray">
          {selected === "a" && t("supervisor.acceptedA")}
          {selected === "b" && t("supervisor.acceptedB")}
          {selected === "manual" && t("conflicts.manualMerge")}
        </p>
        <Button variant="primary" onClick={() => window.location.href = "/supervisor/dashboard"}>
          {t("common.back")}
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-9 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-200 rounded mt-3" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-gray-200 rounded-lg" />
          <div className="h-48 bg-gray-200 rounded-lg" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 bg-gray-200 rounded-lg" />
          <div className="h-10 w-28 bg-gray-200 rounded-lg" />
          <div className="h-10 w-36 bg-gray-200 rounded-lg" />
        </div>
        <div className="h-24 bg-gray-200 rounded-lg" />
      </div>
    )
  }

  if (conflictFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-14 h-14 rounded-full bg-warning-500/10 flex items-center justify-center">
          <AlertTriangle size={32} className="text-warning-500" />
        </div>
        <h2 className="font-display text-2xl text-iodine-brown">Aucun conflit</h2>
        <Button variant="secondary" onClick={() => window.location.href = "/supervisor/dashboard"}>
          {t("common.back")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-iodine-brown tracking-tight">{t("conflicts.resolution")}</h1>
        <p className="text-sm text-chart-gray mt-1">{t("dashboard.conflicts")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className={`border-graph-line ${selected === "a" ? "ring-2 ring-scrub-blue" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-graph-line">
              <Badge variant="info" size="sm">{t("supervisor.versionA")}</Badge>
            </div>
            <div className="space-y-3">
              {conflictFields.map((f) => (
                <div key={f.key} className={`text-sm p-2 rounded ${f.conflicting ? "bg-warning-500/10 border border-warning-500/40" : ""}`}>
                  <p className="text-[11px] uppercase tracking-wider text-chart-gray mb-0.5">{f.label}</p>
                  <div className="flex items-center gap-1.5">
                    {!f.conflicting && <CheckCircle2 size={14} className="text-antiseptic-green shrink-0" />}
                    <span className={`font-medium ${f.conflicting ? "text-iodine-brown" : "text-antiseptic-green"}`}>
                      {f.valueA}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={`border-graph-line ${selected === "b" ? "ring-2 ring-scrub-blue" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-graph-line">
              <Badge variant="info" size="sm">{t("supervisor.versionB")}</Badge>
            </div>
            <div className="space-y-3">
              {conflictFields.map((f) => (
                <div key={f.key} className={`text-sm p-2 rounded ${f.conflicting ? "bg-warning-500/10 border border-warning-500/40" : ""}`}>
                  <p className="text-[11px] uppercase tracking-wider text-chart-gray mb-0.5">{f.label}</p>
                  <div className="flex items-center gap-1.5">
                    {!f.conflicting && <CheckCircle2 size={14} className="text-antiseptic-green shrink-0" />}
                    <span className={`font-medium ${f.conflicting ? "text-iodine-brown" : "text-antiseptic-green"}`}>
                      {f.valueB}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant={selected === "a" ? "primary" : "secondary"}
          className={selected === "a" ? "" : "border-scrub-blue text-scrub-blue"}
          onClick={() => setSelected("a")}
        >
          {t("conflicts.acceptA")}
        </Button>
        <Button
          variant={selected === "b" ? "primary" : "secondary"}
          className={selected === "b" ? "" : "border-scrub-blue text-scrub-blue"}
          onClick={() => setSelected("b")}
        >
          {t("conflicts.acceptB")}
        </Button>
        <Button
          variant={selected === "manual" ? "primary" : "secondary"}
          className={selected === "manual" ? "bg-warning-500 hover:bg-warning-500/90" : "border-warning-500 text-warning-500"}
          onClick={() => setSelected("manual")}
        >
          <GitMerge size={16} />
          {t("conflicts.manualMerge")}
        </Button>
      </div>

      <div className="space-y-3">
        <Textarea
          label={t("conflicts.rationale")}
          placeholder={t("conflicts.rationaleRequired")}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          error={submitting && !rationale.trim() ? t("conflicts.rationaleRequired") : undefined}
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="primary"
            disabled={!selected}
            loading={submitting}
            onClick={handleResolve}
          >
            <AlertTriangle size={16} />
            {t("supervisor.confirmResolution")}
          </Button>
        </div>
      </div>
    </div>
  )
}
