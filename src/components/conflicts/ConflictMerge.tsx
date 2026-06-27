"use client"

import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2, GitMerge, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ConflictField = {
  key: string
  label: string
  base?: string
  local: string
  remote: string
  autoResolved: boolean
}

type FieldResolution = "yours" | "remote" | "manual"

type ConflictFieldState = ConflictField & {
  resolution: FieldResolution | null
  manualValue: string
}

type ConflictMergeProps = {
  fields: ConflictField[]
  recordId?: string
  onResolve: (resolutions: Record<string, { choice: FieldResolution; value: string }>, rationale: string) => Promise<void>
}

function ValueCell({ value, label, isBase }: { value: string; label: string; isBase?: boolean }) {
  return (
    <div className={cn("text-sm", isBase && "text-pencil italic")}>
      <p className="text-[11px] uppercase tracking-wider text-pencil mb-0.5">{label}</p>
      <span className={cn("font-medium", isBase ? "text-pencil" : "text-ink-black")}>
        {value || "—"}
      </span>
    </div>
  )
}

function ResolutionControls({
  resolution,
  onChange,
  manualValue,
  onManualChange,
}: {
  resolution: FieldResolution | null
  onChange: (r: FieldResolution) => void
  manualValue: string
  onManualChange: (v: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2 mt-1">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange("yours")}
          className={cn(
            "px-2.5 py-1 text-xs rounded-md border font-medium transition-colors",
            resolution === "yours"
              ? "bg-ink-blue text-white border-ink-blue"
              : "bg-transparent text-pencil border-graph-line hover:border-ink-blue hover:text-ink-blue"
          )}
        >
          {t("conflicts.acceptYours")}
        </button>
        <button
          type="button"
          onClick={() => onChange("remote")}
          className={cn(
            "px-2.5 py-1 text-xs rounded-md border font-medium transition-colors",
            resolution === "remote"
              ? "bg-scrub-blue text-white border-scrub-blue"
              : "bg-transparent text-pencil border-graph-line hover:border-scrub-blue hover:text-scrub-blue"
          )}
        >
          {t("conflicts.acceptRemote")}
        </button>
        <button
          type="button"
          onClick={() => onChange("manual")}
          className={cn(
            "px-2.5 py-1 text-xs rounded-md border font-medium transition-colors",
            resolution === "manual"
              ? "bg-warning-500 text-white border-warning-500"
              : "bg-transparent text-pencil border-graph-line hover:border-warning-500 hover:text-warning-500"
          )}
        >
          <GitMerge size={12} className="inline mr-0.5" />
          {t("conflicts.manualMerge")}
        </button>
      </div>
      {resolution === "manual" && (
        <input
          type="text"
          value={manualValue}
          onChange={(e) => onManualChange(e.target.value)}
          placeholder={t("conflicts.manualPlaceholder")}
          className="w-full px-2 py-1.5 text-sm rounded-md border border-graph-line text-ink-black placeholder:text-pencil/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue"
        />
      )}
    </div>
  )
}

export function ConflictMerge({ fields, recordId, onResolve }: ConflictMergeProps) {
  const { t } = useTranslation()
  const [fieldStates, setFieldStates] = useState<ConflictFieldState[]>(
    () => fields.map(f => ({ ...f, resolution: null, manualValue: "" }))
  )
  const [rationale, setRationale] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [resolved, setResolved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResolutionChange = useCallback((key: string, resolution: FieldResolution) => {
    setFieldStates(prev => prev.map(f => f.key === key ? { ...f, resolution } : f))
  }, [])

  const handleManualChange = useCallback((key: string, value: string) => {
    setFieldStates(prev => prev.map(f => f.key === key ? { ...f, manualValue: value } : f))
  }, [])

  const unresolved = fieldStates.filter(f => f.autoResolved || f.resolution !== null).length
  const total = fieldStates.length
  const allResolved = unresolved === total

  const handleSubmit = async () => {
    if (!allResolved) return
    if (!rationale.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const resolutions: Record<string, { choice: FieldResolution; value: string }> = {}
      for (const f of fieldStates) {
        if (f.autoResolved) {
          resolutions[f.key] = { choice: "yours", value: f.local }
        } else {
          const choice = f.resolution!
          const value = choice === "yours" ? f.local : choice === "remote" ? f.remote : f.manualValue
          resolutions[f.key] = { choice, value }
        }
      }
      await onResolve(resolutions, rationale)
      setResolved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resolve")
    } finally {
      setSubmitting(false)
    }
  }

  if (resolved) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-14 h-14 rounded-full bg-antiseptic-green/10 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-antiseptic-green" />
        </div>
        <h2 className="font-display text-2xl text-iodine-brown">{t("conflicts.resolved")}</h2>
        <p className="text-sm text-chart-gray text-center max-w-xs">
          {t("conflicts.resolvedDescription")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="font-display text-3xl text-iodine-brown tracking-tight">{t("conflicts.resolution")}</h1>
        <Badge variant="warning" size="sm">{total} {t("conflicts.fields")}</Badge>
      </div>

      <div className="bg-graph-paper rounded-md border border-graph-line overflow-hidden">
        <div className="hidden md:grid grid-cols-3 gap-px bg-graph-line bg-opacity-30">
          <div className="px-4 py-3 bg-white">
            <p className="text-[11px] uppercase tracking-wider text-pencil font-semibold">{t("conflicts.base")}</p>
          </div>
          <div className="px-4 py-3 bg-white">
            <p className="text-[11px] uppercase tracking-wider text-pencil font-semibold">{t("conflicts.yourVersion")}</p>
          </div>
          <div className="px-4 py-3 bg-white">
            <p className="text-[11px] uppercase tracking-wider text-pencil font-semibold">{t("conflicts.remoteVersion")}</p>
          </div>
        </div>

        <div className="divide-y divide-graph-line">
          {fieldStates.map((f) => {
            const isConflicting = !f.autoResolved
            return (
              <div
                key={f.key}
                className={cn(
                  "px-4 py-4 space-y-3",
                  f.autoResolved && "bg-antiseptic-green/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink-black">{f.label}</p>
                  {f.autoResolved && (
                    <Badge variant="success" size="sm">
                      <CheckCircle2 size={12} className="mr-0.5" />
                      {t("conflicts.autoResolved")}
                    </Badge>
                  )}
                  {isConflicting && (
                    <Badge variant="warning" size="sm">
                      <AlertTriangle size={12} className="mr-0.5" />
                      {t("conflicts.conflict")}
                    </Badge>
                  )}
                </div>

                <div className={cn(
                  isConflicting && "border border-warning-500/40 rounded-md p-3 bg-warning-500/[0.03]"
                )}>
                  <div className="md:hidden space-y-3">
                    {f.base !== undefined && (
                      <ValueCell value={f.base} label={t("conflicts.base")} isBase />
                    )}
                    <div className={cn("p-2 rounded", f.resolution === "yours" ? "bg-ink-blue/5 ring-1 ring-ink-blue/20" : "")}>
                      <ValueCell value={f.local} label={t("conflicts.yourVersion")} />
                    </div>
                    <div className={cn("p-2 rounded", f.resolution === "remote" ? "bg-scrub-blue/5 ring-1 ring-scrub-blue/20" : "")}>
                      <ValueCell value={f.remote} label={t("conflicts.remoteVersion")} />
                    </div>
                  </div>

                  <div className="hidden md:grid grid-cols-3 gap-3">
                    {f.base !== undefined && (
                      <div className={cn("p-2 rounded", isConflicting ? "bg-warning-500/5" : "")}>
                        <ValueCell value={f.base!} label={t("conflicts.base")} isBase />
                      </div>
                    )}
                    {f.base === undefined && <div />}
                    <div className={cn("p-2 rounded", f.resolution === "yours" ? "bg-ink-blue/5 ring-1 ring-ink-blue/20" : "")}>
                      <ValueCell value={f.local} label={t("conflicts.yourVersion")} />
                    </div>
                    <div className={cn("p-2 rounded", f.resolution === "remote" ? "bg-scrub-blue/5 ring-1 ring-scrub-blue/20" : "")}>
                      <ValueCell value={f.remote} label={t("conflicts.remoteVersion")} />
                    </div>
                  </div>
                </div>

                {isConflicting && (
                  <ResolutionControls
                    resolution={f.resolution}
                    onChange={(r) => handleResolutionChange(f.key, r)}
                    manualValue={f.manualValue}
                    onManualChange={(v) => handleManualChange(f.key, v)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-pencil">
        <CheckCircle2 size={16} className={allResolved ? "text-antiseptic-green" : "text-pencil/40"} />
        <span>{t("conflicts.fieldsResolved", { count: unresolved, total })}</span>
      </div>

      <div className="space-y-3">
        <Textarea
          label={t("conflicts.rationale")}
          placeholder={t("conflicts.rationaleRequired")}
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          error={submitting && !rationale.trim() ? t("conflicts.rationaleRequired") : error || undefined}
        />
        <div className="flex justify-end">
          <Button
            variant="primary"
            disabled={!allResolved}
            loading={submitting}
            onClick={handleSubmit}
          >
            <AlertTriangle size={16} />
            {t("conflicts.resolve")}
          </Button>
        </div>
      </div>
    </div>
  )
}
