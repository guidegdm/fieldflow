const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"

export async function streamChat(messages: {role:string,content:string}[], onChunk: (text:string) => void): Promise<string> {
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: "deepseek-chat", messages, stream: true, max_tokens: 4096 }),
  })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let full = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value)
    for (const line of chunk.split("\n")) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        const data = JSON.parse(line.slice(6))
        const text = data.choices?.[0]?.delta?.content || ""
        if (text) { full += text; onChunk(text) }
      }
    }
  }
  return full
}
