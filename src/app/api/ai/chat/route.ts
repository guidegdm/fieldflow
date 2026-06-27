import { NextRequest } from "next/server"
import { getAuthUser } from "@/lib/auth/middleware"
import { getStore } from "@/lib/api/in-memory-store"
import { streamChat } from "@/lib/ai/llm-client"
import { SYSTEM_PROMPT } from "@/lib/ai/prompts/system"
import { generateId } from "@/lib/utils"
import type { AgentMessage } from "@/lib/ai/session-store"

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || user.role !== "org_admin") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { messages, workflowId, orgId = "org-1" } = await req.json()
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Messages required" }), { status: 400 })
  }

  const store = getStore()
  const workflow = workflowId ? store.getWorkflow(workflowId) : undefined
  const contextBlob = workflow
    ? `\n\nCurrent workflow context:\n${JSON.stringify(workflow, null, 2)}`
    : ""

  const systemMsg: AgentMessage = { id: generateId(), sessionId: "", role: "system", content: SYSTEM_PROMPT + contextBlob }
  const apiMessages = [systemMsg, ...messages.map((m: any) => ({ role: m.role, content: m.content }))]

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const full = await streamChat(apiMessages, (chunk) => {
          const sse = `data: ${JSON.stringify({ type: "delta", content: chunk })}\n\n`
          controller.enqueue(encoder.encode(sse))
        })
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", content: full })}\n\n`))
      } catch (e) {
        const err = e instanceof Error ? e.message : "Unknown error"
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", content: err })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  })
}
