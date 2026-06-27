import { generateId } from "@/lib/utils"

export interface AgentProposal {
  id: string
  sessionId: string
  workflowId: string
  status: "draft" | "pending_review" | "approved" | "rejected" | "applied" | "conflict"
  operations: any[]
}

const proposals = new Map<string, AgentProposal>()

export function createProposal(sessionId: string, workflowId: string, changes: any[]): AgentProposal {
  const proposal: AgentProposal = { id: generateId(), sessionId, workflowId, status: "draft", operations: changes }
  proposals.set(proposal.id, proposal)
  return proposal
}
