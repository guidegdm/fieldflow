"use client"

import { create } from "zustand"
import { generateId } from "@/lib/utils"
import { resolveQuestion, dismissQuestion } from "@/lib/ai/tools/ask"
import type {
  AgentPhase,
  AgentQuestion,
  AgentAnswer,
  WorkflowProposal,
  ProposedField,
  ProposedState,
  ProposedTransition,
} from "@/lib/ai/types"
import type { WorkflowDefinition } from "@/types/workflow"
import { useWorkflowStore } from "@/stores/workflowStore"

interface AgentStore {
  phase: AgentPhase
  status: string
  runId: string | null
  error: string | null
  abortController: AbortController | null
  step: number
  maxSteps: number
  pendingQuestion: AgentQuestion | null
  proposals: WorkflowProposal | null
  retryCount: number
  maxRetries: number
  warnings: string[]

  startGeneration: (prompt: string, workflow: WorkflowDefinition) => void
  cancelGeneration: () => void
  answerQuestion: (answer: AgentAnswer) => void
  dismissQuestionAction: () => void
  applyProposal: (type: "field" | "state" | "transition", id: string) => void
  dismissProposal: (type: "field" | "state" | "transition", id: string) => void
  applyAllProposals: () => void
  dismissAllProposals: () => void
  reset: () => void
  retry: (prompt: string, workflow: WorkflowDefinition) => void
  setPhase: (phase: AgentPhase) => void
  setStatus: (status: string) => void
  setStep: (step: number) => void
  setError: (error: string) => void
  setProposals: (proposals: WorkflowProposal) => void
  setPendingQuestion: (q: AgentQuestion | null) => void
  setRetryCount: (n: number) => void
  setWarnings: (w: string[]) => void
  handleQuestionEvent: (e: Event) => void
}

const DEFAULT_MAX_STEPS = 8
const DEFAULT_MAX_RETRIES = 3

function handleQuestionEvent(e: Event) {
  const detail = (e as CustomEvent).detail as AgentQuestion
  useAgentStore.setState({ pendingQuestion: detail, phase: "question" })
}

if (typeof window !== "undefined") {
  window.addEventListener("fieldflow:ai-question", handleQuestionEvent)
}

export const useAgentStore = create<AgentStore>()((set, get) => ({
  phase: "idle",
  status: "",
  runId: null,
  error: null,
  abortController: null,
  step: 0,
  maxSteps: DEFAULT_MAX_STEPS,
  pendingQuestion: null,
  proposals: null,
  retryCount: 0,
  maxRetries: DEFAULT_MAX_RETRIES,
  warnings: [],

  handleQuestionEvent,

  startGeneration: (prompt, workflow) => {
    // Abort previous run if one is in progress
    const { abortController: prev } = get()
    prev?.abort()
    dismissQuestion()

    const abort = new AbortController()
    const runId = crypto.randomUUID()
    set({
      runId,
      abortController: abort,
      phase: "thinking",
      status: "ai.status.thinking",
      error: null,
      proposals: null,
      pendingQuestion: null,
      step: 0,
      retryCount: 0,
      warnings: [],
    })

    // Fire-and-forget: import and run the agent loop in background
    ;(async () => {
      const { agentLoop } = await import("@/lib/ai/agent-loop")
      try {
        await agentLoop(prompt, workflow, abort, {
          setPhase: (p) => set({ phase: p }),
          setStatus: (s) => set({ status: s }),
          setStep: (s) => set({ step: s }),
          setError: (e) => set({ error: e, phase: "error" }),
          setProposals: (p) => set({ proposals: p }),
          setRetryCount: (n) => set({ retryCount: n }),
          setWarnings: (w) => set({ warnings: w }),
          setPhaseToIdle: () => set({ phase: "idle" }),
        })
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return
        set({
          phase: "error",
          error: err instanceof Error ? err.message : "ai.error.unknown",
          status: "ai.status.error",
        })
      }
    })()
  },

  cancelGeneration: () => {
    const { abortController } = get()
    dismissQuestion()
    abortController?.abort()
    set({ phase: "cancelled", abortController: null, status: "", pendingQuestion: null })
    setTimeout(() => {
      if (get().phase === "cancelled") set({ phase: "idle" })
    }, 500)
  },

  answerQuestion: (answer) => {
    resolveQuestion(answer)
    set({ pendingQuestion: null })
  },

  dismissQuestionAction: () => {
    dismissQuestion()
    set({ pendingQuestion: null })
  },

  applyProposal: (type, id) => {
    const { proposals } = get()
    if (!proposals) return

    if (type === "field") {
      const item = proposals.fields.find((f) => f.id === id)
      if (!item) return
      const workflowStore = useWorkflowStore.getState()
      workflowStore.addField()
      const w = useWorkflowStore.getState().workflow
      if (!w) return
      const lastField = w.entity.fields[w.entity.fields.length - 1]
      workflowStore.updateField(lastField.id, item.field)
    }

    if (type === "state") {
      const item = proposals.states.find((s) => s.id === id)
      if (!item) return
      const w = useWorkflowStore.getState().workflow
      if (!w) return
      const st = { ...item.state, id: generateId() }
      useWorkflowStore.getState().updateWorkflow({ states: [...w.states, st] })
    }

    if (type === "transition") {
      const item = proposals.transitions.find((t) => t.id === id)
      if (!item) return
      const w = useWorkflowStore.getState().workflow
      if (!w) return
      const tr = { ...item.transition, id: generateId() }
      useWorkflowStore.getState().updateWorkflow({ transitions: [...w.transitions, tr] })
    }

    const nextProposals = {
      name: proposals.name,
      nameEn: proposals.nameEn,
      fields: proposals.fields.filter((f) => f.id !== id),
      states: proposals.states.filter((s) => s.id !== id),
      transitions: proposals.transitions.filter((t) => t.id !== id),
    }

    set({ proposals: nextProposals })

    if (
      nextProposals.fields.length === 0 &&
      nextProposals.states.length === 0 &&
      nextProposals.transitions.length === 0
    ) {
      if (nextProposals.name || nextProposals.nameEn) {
        const workflow = useWorkflowStore.getState().workflow
        if (workflow) {
          useWorkflowStore.getState().updateWorkflow({
            name: nextProposals.name || workflow.name,
            nameEn: nextProposals.nameEn || nextProposals.name || workflow.nameEn,
          })
        }
      }
      set({ phase: "idle", proposals: null, status: "", warnings: [] })
    }
  },

  dismissProposal: (type, id) => {
    const { proposals } = get()
    if (!proposals) return

    const dismissed = new Set([id])
    if (type === "state") {
      proposals.transitions.forEach((t) => {
        if (t.transition.fromState === id || t.transition.toState === id) {
          dismissed.add(t.id)
        }
      })
    }

    const nextProposals = {
      name: proposals.name,
      nameEn: proposals.nameEn,
      fields: proposals.fields.filter((f) => !dismissed.has(f.id)),
      states: proposals.states.filter((s) => !dismissed.has(s.id)),
      transitions: proposals.transitions.filter((t) => !dismissed.has(t.id)),
    }

    set({ proposals: nextProposals })

    if (
      nextProposals.fields.length === 0 &&
      nextProposals.states.length === 0 &&
      nextProposals.transitions.length === 0
    ) {
      set({ phase: "idle", proposals: null, status: "", warnings: [] })
    }
  },

  applyAllProposals: () => {
    const { proposals } = get()
    if (!proposals) return
    if (proposals.name || proposals.nameEn) {
      const workflow = useWorkflowStore.getState().workflow
      if (workflow) {
        useWorkflowStore.getState().updateWorkflow({
          name: proposals.name || workflow.name,
          nameEn: proposals.nameEn || proposals.name || workflow.nameEn,
        })
      }
    }
    for (const f of [...proposals.fields]) get().applyProposal("field", f.id)
    for (const s of [...proposals.states]) get().applyProposal("state", s.id)
    for (const t of [...proposals.transitions]) get().applyProposal("transition", t.id)
    if (proposals.fields.length + proposals.states.length + proposals.transitions.length === 0) {
      set({ phase: "idle", proposals: null, status: "", warnings: [] })
    }
  },

  dismissAllProposals: () => {
    set({ phase: "idle", proposals: null, status: "", warnings: [] })
  },

  reset: () => {
    const { abortController } = get()
    dismissQuestion()
    abortController?.abort()
    set({
      phase: "idle",
      status: "",
      runId: null,
      error: null,
      abortController: null,
      step: 0,
      pendingQuestion: null,
      proposals: null,
      retryCount: 0,
      warnings: [],
    })
  },

  retry: (prompt, workflow) => {
    get().reset()
    get().startGeneration(prompt, workflow)
  },

  setPhase: (phase) => set({ phase }),
  setStatus: (status) => set({ status }),
  setStep: (step) => set({ step }),
  setError: (error) => set({ error, phase: "error" }),
  setProposals: (proposals) => set({ proposals }),
  setPendingQuestion: (q) => set({ pendingQuestion: q, phase: q ? "question" : "generating" }),
  setRetryCount: (n) => set({ retryCount: n }),
  setWarnings: (w) => set({ warnings: w }),
}))
