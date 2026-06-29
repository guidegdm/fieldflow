import type { WorkflowDefinition, WorkflowField, WorkflowState, WorkflowTransition } from "@/types/workflow"

export interface ToolDef<P = Record<string, unknown>, R = unknown> {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (params: P, ctx: ToolContext) => Promise<ToolResult<R>>
}

export interface ToolContext {
  workflowSnapshot: WorkflowDefinition
  runId: string
  signal: AbortSignal
}

export interface ToolResult<R = unknown> {
  success: boolean
  data?: R
  text: string
  error?: string
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool"
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface LLMResponse {
  message: {
    role: "assistant"
    content: string | null
    tool_calls?: ToolCall[]
  }
  finish_reason: "stop" | "tool_calls" | "length" | "content_filter"
  usage?: { prompt_tokens: number; completion_tokens: number }
}

export type AgentPhase =
  | "idle"
  | "thinking"
  | "generating"
  | "validating"
  | "correcting"
  | "proposing"
  | "question"
  | "error"
  | "cancelled"

export interface AgentQuestion {
  id: string
  header: string
  question: string
  options: { label: string; description?: string }[]
  multiple: boolean
  custom: boolean
}

export interface ProposedField {
  id: string
  action: "add"
  field: WorkflowField
  conflicts: string[]
}

export interface ProposedState {
  id: string
  action: "add"
  state: WorkflowState
  conflicts: string[]
}

export interface ProposedTransition {
  id: string
  action: "add"
  transition: WorkflowTransition
  conflicts: string[]
  dependsOnStates: string[]
}

export interface WorkflowProposal {
  name?: string
  nameEn?: string
  fields: ProposedField[]
  states: ProposedState[]
  transitions: ProposedTransition[]
  message?: string
}

export type AgentAnswer = string[]
