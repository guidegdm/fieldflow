"use client"

import { useTranslation } from "react-i18next"
import { AlertTriangle, CheckCircle2, Sparkles, XCircle } from "lucide-react"
import { useAgentStore } from "@/stores/agentStore"
import type { AgentPhase } from "@/lib/ai/types"

const PHASE_LABELS: Record<AgentPhase, string> = {
  idle: "",
  thinking: "ai.status.thinking",
  generating: "ai.status.generating",
  validating: "ai.status.validating",
  correcting: "ai.status.correcting",
  proposing: "ai.status.proposing",
  question: "ai.status.question",
  error: "ai.status.error",
  cancelled: "ai.status.cancelled",
}

export function AgentStatusBar() {
  const { t } = useTranslation()
  const phase = useAgentStore((s) => s.phase)
  const status = useAgentStore((s) => s.status)
  const step = useAgentStore((s) => s.step)
  const maxSteps = useAgentStore((s) => s.maxSteps)
  const retryCount = useAgentStore((s) => s.retryCount)
  const maxRetries = useAgentStore((s) => s.maxRetries)
  const warnings = useAgentStore((s) => s.warnings)
  const error = useAgentStore((s) => s.error)
  const proposals = useAgentStore((s) => s.proposals)
  const cancelGeneration = useAgentStore((s) => s.cancelGeneration)
  const applyAllProposals = useAgentStore((s) => s.applyAllProposals)
  const dismissAllProposals = useAgentStore((s) => s.dismissAllProposals)
  const retry = useAgentStore((s) => s.retry)

  if (phase === "idle") return null

  const label = PHASE_LABELS[phase]
  const agentLabel = t("workflow.aiAssistant", "AI assistant")

  // Proposing
  if (phase === "proposing" && proposals) {
    const total = proposals.fields.length + proposals.states.length + proposals.transitions.length
    if (total === 0) {
      return (
        <div className="border-b border-graph-line bg-white/90 px-3 py-2 backdrop-blur sm:px-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-full border border-graph-line bg-white px-3 py-2 text-xs text-pencil shadow-sm">
          <div className="flex min-w-0 items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-antiseptic-green" />
            <span>{t("ai.status.empty", "No proposals to show")}</span>
          </div>
          <button
            onClick={() => useAgentStore.setState({ phase: "idle", proposals: null })}
            className="shrink-0 rounded-full px-2 py-1 text-[10px] text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
          >
            {t("ai.dismiss", "Dismiss")}
          </button>
          </div>
        </div>
      )
    }
    return (
      <div className="border-b border-graph-line bg-white/90 px-3 py-2 backdrop-blur sm:px-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 rounded-xl border border-graph-line bg-white px-3 py-2 text-xs text-pencil shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-antiseptic-green/10 text-antiseptic-green">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 truncate font-medium text-ink-black">{agentLabel}</span>
          <span className="shrink-0 text-pencil">{t(label, "Ready")} ({total})</span>
          {warnings.length > 0 && (
            <span className="inline-flex items-center gap-1 text-warning-500" title={warnings.join("\n")}>
              <AlertTriangle className="h-3.5 w-3.5" />
              {warnings.length}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={applyAllProposals}
            className="rounded-full bg-ink-blue px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-ink-blue/90"
          >
            {t("ai.proposal.applyAll", "Apply all")}
          </button>
          <button
            onClick={dismissAllProposals}
            className="rounded-full px-3 py-1.5 text-[11px] text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
          >
            {t("ai.proposal.dismissAll", "Dismiss all")}
          </button>
        </div>
        </div>
      </div>
    )
  }

  // Error
  if (phase === "error") {
    return (
      <div className="border-b border-danger-500/20 bg-danger-500/5 px-3 py-2 sm:px-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-xl border border-danger-500/20 bg-white px-3 py-2 text-xs shadow-sm">
        <div className="flex min-w-0 items-center gap-2 text-danger-600">
          <XCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">{error || t(label, "Error")}</span>
        </div>
        <button
          onClick={cancelGeneration}
          className="shrink-0 rounded-full px-2 py-1 text-[10px] text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
        >
          {t("ai.dismiss", "Dismiss")}
        </button>
        </div>
      </div>
    )
  }

  // Question
  if (phase === "question") {
    return (
      <div className="border-b border-graph-line bg-white/90 px-3 py-2 backdrop-blur sm:px-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-xl border border-graph-line bg-white px-3 py-2 text-xs text-pencil shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-ink-blue" />
          <span className="truncate">{t(label, "Awaiting input")}</span>
        </div>
        <button
          onClick={cancelGeneration}
          className="shrink-0 rounded-full px-2 py-1 text-[10px] text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
        >
          {t("ai.cancel", "Cancel")}
        </button>
        </div>
      </div>
    )
  }

  // Active phases (thinking, generating, validating, correcting)
  const progress = maxSteps > 0 ? Math.round((step / maxSteps) * 100) : 0
  const boundedProgress = Math.max(8, Math.min(progress, 100))

  return (
    <div className="border-b border-graph-line bg-white/90 px-3 py-2 backdrop-blur sm:px-4">
      <div className="mx-auto max-w-6xl rounded-xl border border-graph-line bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-xs text-pencil">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-blue/10 text-ink-blue">
            <span className="absolute inset-0 rounded-full bg-ink-blue/10 ai-pulse-ring" />
            <Sparkles className="relative h-4 w-4" />
          </span>
          <span className="hidden shrink-0 font-medium text-ink-black sm:inline">{agentLabel}</span>
          <span className="min-w-0 truncate">
            {t(status, t(label, "Working..."))}
          </span>
          {retryCount > 0 && (
            <span className="shrink-0 rounded-full bg-warning-500/10 px-2 py-0.5 text-[10px] text-warning-600">
              {t("ai.status.retry", "Retry")} {retryCount}/{maxRetries}
            </span>
          )}
        </div>
        <button
          onClick={cancelGeneration}
          className="shrink-0 rounded-full px-2 py-1 text-[10px] text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
        >
          {t("ai.cancel", "Cancel")}
        </button>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-graph-paper">
        <div
          className="ai-progress-bar h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${boundedProgress}%` }}
        />
      </div>
      </div>
    </div>
  )
}
