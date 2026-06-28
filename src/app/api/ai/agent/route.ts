import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth/middleware"

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().max(32000).nullable().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      })
    )
    .optional(),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
})

const agentRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(100),
  tools: z.array(z.record(z.string(), z.unknown())).max(20).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return Response.json({ error: "Non authentifié" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = agentRequestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: "Requête invalide", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { messages, tools } = parsed.data
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return Response.json(
        { error: "Clé API DeepSeek non configurée" },
        { status: 500 }
      )
    }

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        tools: tools?.length ? tools : undefined,
        tool_choice: tools?.length ? "auto" : undefined,
        max_tokens: 4096,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return Response.json(
        {
          error: `Erreur API DeepSeek ${res.status}`,
          detail: errText.slice(0, 500),
        },
        { status: res.status }
      )
    }

    const data = await res.json()
    return Response.json(data)
  } catch (err: unknown) {
    return Response.json(
      { error: "Erreur interne", detail: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    )
  }
}
