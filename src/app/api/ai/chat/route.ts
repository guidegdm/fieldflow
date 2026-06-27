export const runtime = "edge"

export async function POST(request: Request) {
  try {
    const { message } = await request.json()

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const response = `Bonjour! Je suis l'assistant FieldFlow. Vous avez dit: "${message}".\n\nJe peux vous aider à créer des workflows humanitaires, gérer des enregistrements de bénéficiaires, ou configurer des règles de validation.`

        const words = response.split(/(\s+)/)
        for (const word of words) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: word })}\n\n`))
          await new Promise((r) => setTimeout(r, 30))
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
