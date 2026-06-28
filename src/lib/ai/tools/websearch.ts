import type { ToolDef } from "@/lib/ai/types"

export const webSearchTool: ToolDef<{ query: string }> = {
  name: "web_search",
  description:
    "Search the web for humanitarian workflow patterns, best practices for field data collection, or DRC-specific needs (nutrition, WASH, protection, etc). Use sparingly.",
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
      text: "Web search unavailable (not configured). Proceed with your training knowledge of humanitarian workflows.",
      error: "NOT_CONFIGURED",
    }
  },
}
