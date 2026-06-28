"use client"

import { useTranslation } from "react-i18next"
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

  // Proposing
  if (phase === "proposing" && proposals) {
    const total = proposals.fields.length + proposals.states.length + proposals.transitions.length
    if (total === 0) {
      return (
        <div className="flex items-center justify-between px-4 py-2 bg-clay/5 border-b border-clay/10 text-xs text-volcanic-ash">
          <div className="flex items-center gap-2">
            <span>✨</span>
            <span>{t("ai.status.empty", "No proposals to show")}</span>
          </div>
          <button
            onClick={() => useAgentStore.setState({ phase: "idle", proposals: null })}
            className="px-2 py-0.5 text-[10px] text-pencil hover:text-ink-black transition-colors"
          >
            {t("ai.dismiss", "Dismiss")}
          </button>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-between px-4 py-1.5 bg-clay/5 border-b border-clay/10 text-xs text-volcanic-ash">
        <div className="flex items-center gap-2.5">
          <span className="text-base">✨</span>
          <span>
            {t(label, "Ready")} ({total})
          </span>
          {warnings.length > 0 && (
            <span className="text-warning-500" title={warnings.join("\n")}>
              {warnings.length} ⚠
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={applyAllProposals}
            className="px-2 py-0.5 text-[10px] bg-clay text-graph-paper rounded hover:bg-clay/90 transition-colors font-medium"
          >
            {t("ai.proposal.applyAll", "Apply all")}
          </button>
          <button
            onClick={dismissAllProposals}
            className="px-2 py-0.5 text-[10px] text-pencil hover:text-ink-black transition-colors"
          >
            {t("ai.proposal.dismissAll", "Dismiss all")}
          </button>
        </div>
      </div>
    )
  }

  // Error
  if (phase === "error") {
    return (
      <div className="flex items-center justify-between px-4 py-1.5 bg-danger-500/5 border-b border-danger-500/20 text-xs">
        <div className="flex items-center gap-2 min-w-0 text-danger-600">
          <span className="text-xs">✕</span>
          <span className="truncate">{error || t(label, "Error")}</span>
        </div>
        <button
          onClick={cancelGeneration}
          className="px-2 py-0.5 text-[10px] text-pencil hover:text-ink-black transition-colors"
        >
          {t("ai.dismiss", "Dismiss")}
        </button>
      </div>
    )
  }

  // Question
  if (phase === "question") {
    return (
      <div className="flex items-center justify-between px-4 py-1.5 bg-clay/5 border-b border-clay/10 text-xs text-volcanic-ash">
        <div className="flex items-center gap-2 min-w-0">
          <span>✨</span>
          <span className="truncate">{t(label, "Awaiting input")}</span>
        </div>
        <button
          onClick={cancelGeneration}
          className="px-2 py-0.5 text-[10px] text-pencil hover:text-rebar transition-colors"
        >
          {t("ai.cancel", "Cancel")}
        </button>
      </div>
    )
  }

  // Active phases (thinking, generating, validating, correcting)
  const progress = maxSteps > 0 ? Math.round((step / maxSteps) * 100) : 0

  return (
    <div className="flex flex-col px-4 py-1.5 bg-clay/5 border-b border-clay/10">
      <div className="flex items-center justify-between text-xs text-volcanic-ash">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base animate-pulse">✨</span>
          <span className="truncate">
            {t(status, t(label, "Working..."))}
          </span>
          {retryCount > 0 && (
            <span className="text-[10px] text-warning-600">
              {t("ai.status.retry", "Retry")} {retryCount}/{maxRetries}
            </span>
          )}
        </div>
        <button
          onClick={cancelGeneration}
          className="px-2 py-0.5 text-[10px] text-pencil hover:text-rebar transition-colors"
        >
          {t("ai.cancel", "Cancel")}
        </button>
      </div>
      <div className="mt-1 h-0.5 w-full bg-clay/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-clay/40 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  )
}
