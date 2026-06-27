import type { AgentState } from "./agent-state"

export interface AgentSession { id: string; orgId: string; workflowId?: string; state: AgentState; createdAt: number }
export interface AgentProposal { id: string; sessionId: string; workflowId: string; status: string; operations: any[] }
export interface AgentMessage { id: string; sessionId: string; role: "user"|"assistant"|"system"; content: string }

class AISessionStore {
  sessions = new Map<string, AgentSession>()
  proposals = new Map<string, AgentProposal>()
  messages = new Map<string, AgentMessage[]>()
}
export const aiStore = new AISessionStore()
