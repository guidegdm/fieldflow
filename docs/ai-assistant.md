# AI Assistant

The AI assistant helps admins draft workflow changes. It is not a general chatbot and it does not auto-apply or auto-publish changes.

## UI Flow

The workflow builder opens the assistant from [src/app/(routes)/admin/workflows/[id]/page.tsx](<../src/app/(routes)/admin/workflows/[id]/page.tsx:187>). Submitting a prompt calls `startGeneration(prompt, workflow)` from [src/stores/agentStore.ts](../src/stores/agentStore.ts:147).

While generation runs, [src/components/ai/AgentStatusBar.tsx](../src/components/ai/AgentStatusBar.tsx:20) shows progress and actions. Clarifying questions render through [src/components/ai/QuestionCard.tsx](../src/components/ai/QuestionCard.tsx:1).

## Agent Loop

The system prompt in [src/lib/ai/prompts.ts](../src/lib/ai/prompts.ts:3) tells the model to inspect the workflow first, avoid raw JSON, ask clarifying questions only when necessary, and produce shippable workflow changes.

[src/lib/ai/agent-loop.ts](../src/lib/ai/agent-loop.ts:124) runs a bounded tool loop:

- maximum 8 steps,
- maximum 3 clarification questions,
- validation retries,
- timeout for clarification,
- structured proposal output.

Available tools are registered in [src/lib/ai/tools/index.ts](../src/lib/ai/tools/index.ts:1). The active tools are workflow inspection, workflow type info, proposal generation, and clarification. `web_search` exists as a stub but is not configured as an active tool.

## Proposals And Validation

`propose_changes` accepts structured workflow edits and validates the tool payload with Zod in [src/lib/ai/tools/propose.ts](../src/lib/ai/tools/propose.ts:1).

`validateProposal()` checks duplicate keys, invalid identifiers, unknown roles, missing transition endpoints, unsupported field types, missing options, missing labels, and missing initial state in [src/lib/ai/validator/validate.ts](../src/lib/ai/validator/validate.ts:1).

When validation passes, proposal items appear as ghost changes. The user can apply or dismiss individual changes or apply all changes through [src/stores/agentStore.ts](../src/stores/agentStore.ts:147).

## Model Call

The browser calls `/api/ai/agent`. The route requires authentication and `DEEPSEEK_API_KEY`, then forwards messages and tool definitions to the configured DeepSeek-compatible endpoint in [src/app/api/ai/agent/route.ts](../src/app/api/ai/agent/route.ts:1).

The LLM client defaults to a flash/chat-style model and retries transient failures or 429s with backoff in [src/lib/ai/llm-client.ts](../src/lib/ai/llm-client.ts:1).

## Safety And Limitations

- The assistant proposes changes only; humans apply and publish.
- It does not make eligibility, humanitarian, financial, or medical decisions.
- Validation is structural, not a guarantee of real-world process quality.
- Clarification can time out or be skipped.
- Web search is not configured in this repository.
