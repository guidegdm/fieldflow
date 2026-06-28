import { inspectWorkflowTool } from "./inspect"
import { getWorkflowTypesTool } from "./types-info"
import { proposeChangesTool } from "./propose"
import { webSearchTool } from "./websearch"
import type { ToolDef, ToolContext, ToolResult } from "@/lib/ai/types"

const tools: Record<string, ToolDef<Record<string, unknown>, unknown>> = {
  inspect_workflow: inspectWorkflowTool as ToolDef<Record<string, unknown>, unknown>,
  get_workflow_types: getWorkflowTypesTool as ToolDef<Record<string, unknown>, unknown>,
  propose_changes: proposeChangesTool as ToolDef<Record<string, unknown>, unknown>,
  web_search: webSearchTool as ToolDef<Record<string, unknown>, unknown>,
}

export function getToolDefinitions(): Record<string, unknown>[] {
  const defs = Object.values(tools)
    .filter((t) => t.name !== "web_search")
    .map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))

  defs.push({
    type: "function" as const,
    function: {
      name: "ask_clarification",
      description:
        "Ask the user a clarifying question when crucial information is missing. ONLY use when the answer significantly impacts the workflow design. Max 3 uses per run. Prefer multiple-choice over free-text.",
      parameters: {
        type: "object",
        properties: {
          header: { type: "string", description: "Short category label (e.g., 'Rôles', 'Champs obligatoires')" },
          question: { type: "string", description: "The question to ask the user, in French" },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Option label in French" },
                description: { type: "string", description: "Short explanation of this option" },
              },
              required: ["label"],
            },
          },
          multiple: { type: "boolean", description: "Can user select multiple options?", default: false },
          custom: { type: "boolean", description: "Allow free-text 'Autre...' option?", default: false },
        },
        required: ["header", "question", "options"],
      },
    },
  })

  return defs
}

export async function executeTool(
  name: string,
  args: string,
  ctx: ToolContext
): Promise<ToolResult> {
  const tool = tools[name]
  if (!tool) return { success: false, text: `Unknown tool: ${name}`, error: "UNKNOWN_TOOL" }
  try {
    const parsed = JSON.parse(args)
    return await tool.execute(parsed, ctx)
  } catch {
    return { success: false, text: `Invalid arguments for ${name}`, error: "INVALID_ARGS" }
  }
}
