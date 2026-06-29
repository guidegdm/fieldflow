import { callLLM } from "@/lib/ai/llm-client"
import { buildSystemPrompt, MAX_STEPS_PROMPT, NO_PROPOSAL_PROMPT } from "@/lib/ai/prompts"
import { executeTool } from "@/lib/ai/tools"
import { resetQuestionCount, getQuestionCount, showQuestion, dismissQuestion } from "@/lib/ai/tools/ask"
import { validateProposal, buildValidationFeedback } from "@/lib/ai/validator/validate"
import type {
  WorkflowProposal,
  Message,
  AgentPhase,
  ProposedField,
  ProposedState,
  ProposedTransition,
} from "@/lib/ai/types"
import type { WorkflowDefinition, WorkflowField, WorkflowState, WorkflowTransition } from "@/types/workflow"

interface AgentCallbacks {
  setPhase: (phase: AgentPhase) => void
  setStatus: (status: string) => void
  setStep: (step: number) => void
  setError: (error: string) => void
  setProposals: (proposals: WorkflowProposal) => void
  setRetryCount: (n: number) => void
  setWarnings: (w: string[]) => void
  setPhaseToIdle: () => void
}

const MAX_STEPS = 8
const MAX_RETRIES = 3
const MAX_QUESTIONS = 3
const QUESTION_TIMEOUT_MS = 300_000

function autoPositionStates(
  existingStates: WorkflowState[],
  ghostStates: ProposedState[]
): void {
  const rightmost = Math.max(...existingStates.map((s) => s.x + 180), 100)
  ghostStates.forEach((p, i) => {
    p.state.x = rightmost + 20 + (i % 3) * 200
    p.state.y = 80 + Math.floor(i / 3) * 120
  })
}

function buildProposalFromToolData(
  data: Record<string, unknown>
): WorkflowProposal {
  const fields: ProposedField[] = ((data.fields as unknown[]) ?? []).map((f, i) => {
    const field = f as Record<string, unknown>
    return {
      id: `ai-field-${i}-${crypto.randomUUID().slice(0, 8)}`,
      action: "add" as const,
      field: {
        id: `ai-field-${Date.now()}-${i}`,
        key: (field.key as string) || `field_${i}`,
        label: (field.label as string) || "",
        labelEn: (field.labelEn as string) || "",
        type: (field.type as string) || "text",
        required: (field.required as boolean) ?? false,
        order: i,
        section: (field.section as string) || "default",
        options: (field.options as WorkflowField["options"]) ?? undefined,
      },
      conflicts: [],
    }
  })

  const states: ProposedState[] = ((data.states as unknown[]) ?? []).map((s, i) => {
    const state = s as Record<string, unknown>
    return {
      id: `ai-state-${Date.now()}-${i}`,
      action: "add" as const,
      state: {
        id: `ai-state-${Date.now()}-${i}`,
        key: (state.key as string) || `state_${i}`,
        label: (state.label as string) || "",
        labelEn: (state.labelEn as string) || "",
        color: (state.color as string) || "#6B7280",
        isInitial: (state.isInitial as boolean) ?? false,
        isTerminal: (state.isTerminal as boolean) ?? false,
        x: 0,
        y: 0,
      },
      conflicts: [],
    }
  })

  const transitions: ProposedTransition[] = ((data.transitions as unknown[]) ?? []).map(
    (t, i) => {
      const tr = t as Record<string, unknown>
      return {
        id: `ai-transition-${Date.now()}-${i}`,
        action: "add" as const,
        transition: {
          id: `ai-transition-${Date.now()}-${i}`,
          key: (tr.key as string) || `transition_${i}`,
          label: (tr.label as string) || "",
          labelEn: (tr.labelEn as string) || "",
          fromState: (tr.fromState as string) || "",
          toState: (tr.toState as string) || "",
          requiredRoles: (tr.requiredRoles as string[]) ?? [],
        },
        conflicts: [],
        dependsOnStates: [tr.fromState as string, tr.toState as string].filter(Boolean),
      }
    }
  )

  return {
    name: data.name as string | undefined,
    nameEn: data.nameEn as string | undefined,
    fields,
    states,
    transitions,
    message: data.message as string | undefined,
  }
}

function isEmptyProposal(proposal: WorkflowProposal): boolean {
  return proposal.fields.length + proposal.states.length + proposal.transitions.length === 0 && !proposal.name && !proposal.nameEn
}

export async function agentLoop(
  prompt: string,
  workflow: WorkflowDefinition,
  abort: AbortController,
  callbacks: AgentCallbacks
) {
  resetQuestionCount()
  const snapshot = structuredClone(workflow)

  const messages: Message[] = [
    { role: "system", content: buildSystemPrompt(snapshot) },
    { role: "user", content: prompt },
  ]

  let step = 0
  let retryCount = 0
  let proposal: WorkflowProposal | null = null
  let prevErrorCount = Infinity
  let maxStepsPromptSent = false

  callbacks.setPhase("thinking")
  callbacks.setStatus("ai.status.thinking")

  while (true) {
    if (abort.signal.aborted) {
      callbacks.setPhase("cancelled")
      break
    }

    if (step >= MAX_STEPS) {
      if (!maxStepsPromptSent) {
        messages.push({ role: "system", content: MAX_STEPS_PROMPT })
        maxStepsPromptSent = true
      }
      callbacks.setStatus("ai.status.maxSteps")
    }

    if (step >= MAX_STEPS + 3) {
      const p = proposal as WorkflowProposal | null
      if (p) {
        autoPositionStates(snapshot.states, p.states)
        callbacks.setProposals(p)
        callbacks.setPhase("proposing")
        callbacks.setStatus("ai.status.proposing")
        break
      }
      callbacks.setError("ai.error.maxSteps")
      break
    }

    step++
    callbacks.setStep(step)

    try {
      const response = await callLLM(messages, abort.signal)
      messages.push({
        role: "assistant",
        content: response.message.content ?? "",
        tool_calls: response.message.tool_calls,
      })

      for (const toolCall of response.message.tool_calls ?? []) {
        const args = toolCall.function.arguments

        if (toolCall.function.name === "propose_changes") {
          const result = await executeTool("propose_changes", args, {
            workflowSnapshot: snapshot,
            runId: "",
            signal: abort.signal,
          })

          if (result.success && result.data) {
            const nextProposal = buildProposalFromToolData(result.data as Record<string, unknown>)
            if (isEmptyProposal(nextProposal)) {
              messages.push({
                role: "tool",
                content: "EMPTY_PROPOSAL: propose_changes must include at least one field, state, or transition. Call propose_changes again with concrete structured changes, not only a message.",
                tool_call_id: toolCall.id,
              })
              proposal = null
              continue
            }
            proposal = nextProposal
            callbacks.setPhase("generating")
            callbacks.setStatus("ai.status.generating")
          }

          messages.push({
            role: "tool",
            content: result.text,
            tool_call_id: toolCall.id,
          })
        } else if (toolCall.function.name === "ask_clarification") {
          const qCount = getQuestionCount()
          if (qCount >= MAX_QUESTIONS) {
            messages.push({
              role: "tool",
              content: "Maximum questions reached. Produce a proposal with best-guess defaults.",
              tool_call_id: toolCall.id,
            })
          } else {
            const parsed = JSON.parse(args) as {
              header: string
              question: string
              options: { label: string; description?: string }[]
              multiple?: boolean
              custom?: boolean
            }

            callbacks.setPhase("question")
            callbacks.setStatus("ai.status.question")

            const answer = await Promise.race([
              showQuestion({
                header: parsed.header,
                question: parsed.question,
                options: parsed.options,
                multiple: parsed.multiple ?? false,
                custom: parsed.custom ?? false,
              }),
              new Promise<string[]>((resolve) =>
                setTimeout(() => {
                  dismissQuestion()
                  resolve([])
                }, QUESTION_TIMEOUT_MS)
              ),
            ])

            callbacks.setPhase("thinking")
            callbacks.setStatus("ai.status.thinking")

            const answerText = answer.length
              ? `User answered: ${answer.join(", ")}`
              : "User dismissed the question (timeout or skip). Proceed with defaults."

            messages.push({
              role: "tool",
              content: answerText,
              tool_call_id: toolCall.id,
            })
          }
        } else {
          const result = await executeTool(toolCall.function.name, args, {
            workflowSnapshot: snapshot,
            runId: "",
            signal: abort.signal,
          })
          messages.push({
            role: "tool",
            content: result.text,
            tool_call_id: toolCall.id,
          })
        }
      }

      if (proposal) {
        callbacks.setPhase("validating")
        callbacks.setStatus("ai.status.validating")

        const errors = validateProposal(proposal, snapshot)
        if (errors.length === 0) {
          autoPositionStates(snapshot.states, proposal.states)
          callbacks.setPhase("proposing")
          callbacks.setStatus("ai.status.proposing")
          callbacks.setProposals(proposal)
          break
        }

        if (retryCount < MAX_RETRIES) {
          const errorCount = errors.length
          const oscillating = retryCount >= 2 && errorCount >= prevErrorCount

          if (oscillating) {
            autoPositionStates(snapshot.states, proposal.states)
            callbacks.setPhase("proposing")
            callbacks.setStatus("ai.status.proposingWithWarnings")
            callbacks.setProposals(proposal)
            callbacks.setWarnings(errors.map((e) => e.message))
            break
          }

          prevErrorCount = errorCount
          retryCount++
          callbacks.setPhase("correcting")
          callbacks.setStatus(`ai.status.correcting`)
          callbacks.setRetryCount(retryCount)

          const feedback = buildValidationFeedback(errors)
          messages.push({ role: "user", content: feedback })
          proposal = null
        } else {
          autoPositionStates(snapshot.states, proposal.states)
          callbacks.setPhase("proposing")
          callbacks.setStatus("ai.status.proposingWithWarnings")
          callbacks.setProposals(proposal)
          callbacks.setWarnings(errors.map((e) => e.message))
          break
        }
      }

      if (
        response.finish_reason === "stop" &&
        !response.message.tool_calls?.length &&
        !proposal
      ) {
        messages.push({ role: "system", content: NO_PROPOSAL_PROMPT })
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        callbacks.setPhase("cancelled")
        break
      }
      callbacks.setError(err instanceof Error ? err.message : "ai.error.unknown")
      callbacks.setPhase("error")
      callbacks.setStatus("ai.status.error")
      break
    }
  }

  return proposal
}
