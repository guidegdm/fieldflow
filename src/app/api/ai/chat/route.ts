import { NextRequest } from "next/server"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth/middleware"

const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(8000),
})

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(40),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }

    const parsed = chatRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Messages requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }
    const { messages } = parsed.data

    const systemMsg = {
      role: "system",
      content: `Tu es l'Architecte Workflow FieldFlow. Tu aides à créer des workflows humanitaires.
Réponds en JSON avec ce format: {"type":"message","content":"..."} ou {"type":"proposal","operations":[...]}.
Les workflows ont: entités, champs (text,number,select,multi_select,date,gps,photo,textarea), états, transitions, rôles (field_worker,supervisor,org_admin).
Exemple de réponse: {"type":"message","content":"Je vais créer un workflow de distribution alimentaire avec..."}`
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", content: "Clé API DeepSeek non configurée" })}\n\n`))
          c.close()
        }
      })
      return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } })
    }

    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [systemMsg, ...messages],
        stream: true,
        max_tokens: 2048,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", content: "Erreur API DeepSeek: " + res.status })}\n\n`))
          c.close()
        }
      })
      return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } })
    }

    const encoder = new TextEncoder()
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) { controller.close(); break }
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6))
                const text = data.choices?.[0]?.delta?.content || ""
                if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: text })}\n\n`))
              } catch {}
            }
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`))
      }
    })

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
