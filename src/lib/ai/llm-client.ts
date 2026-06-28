import { getToolDefinitions } from "@/lib/ai/tools"
import type { Message, LLMResponse, ToolCall } from "@/lib/ai/types"

export async function callLLM(
  messages: Message[],
  signal: AbortSignal,
  retryCount = 0
): Promise<LLMResponse> {
  const maxRetries = 3
  const baseDelay = 2000

  try {
    const tools = getToolDefinitions()
    const res = await fetch("/api/ai/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ messages, tools }),
      signal,
    })

    if (!res.ok) {
      if (res.status === 429 && retryCount < maxRetries) {
        const retryAfter = parseInt(res.headers.get("Retry-After") ?? "5")
        await new Promise((r) => setTimeout(r, retryAfter * 1000))
        return callLLM(messages, signal, retryCount + 1)
      }
      if (res.status >= 500 && retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount)
        await new Promise((r) => setTimeout(r, delay))
        return callLLM(messages, signal, retryCount + 1)
      }
      const errData = await res.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errData.error ?? `API error ${res.status}`)
    }

    const data = await res.json()
    const choice = data.choices?.[0]
    return {
      message: choice?.message ?? { role: "assistant", content: null },
      finish_reason: choice?.finish_reason ?? "stop",
      usage: data.usage,
    }
  } catch (err) {
    if (retryCount < maxRetries && !signal.aborted) {
      const delay = baseDelay * Math.pow(2, retryCount)
      await new Promise((r) => setTimeout(r, delay))
      return callLLM(messages, signal, retryCount + 1)
    }
    throw err
  }
}
