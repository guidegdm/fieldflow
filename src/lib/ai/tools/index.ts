import { inspectTools } from "./inspect"
import { createProposal } from "./propose"

export const tools = {
  ...inspectTools,
  createProposal,
}

export function getToolDescriptions(): string {
  return `Available tools:
- getWorkflow(id): Get workflow definition
- getAllWorkflows(): List all workflows
- getRecordsByWorkflow(wfId): Get records for workflow
- createProposal(sessionId, workflowId, changes): Create a proposal with changes`
}
