import type { ToolDef } from "@/lib/ai/types"

export const webSearchTool: ToolDef<{ query: string }> = {
  name: "web_search",
  description:
    "Search the web for sector-specific workflow patterns or best practices for field data collection. Use sparingly and only when current product knowledge is not enough.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query in English or French" },
    },
    required: ["query"],
  },
  async execute() {
    // Web search requires SEARCH_API_KEY which is not configured in the demo.
    // Degrade gracefully — LLM uses its training knowledge.
    return {
      success: false,
      text: "Web search unavailable (not configured). Proceed with your training knowledge of operational workflows and ask a clarifying question if the domain is unclear.",
      error: "NOT_CONFIGURED",
    }
  },
}
