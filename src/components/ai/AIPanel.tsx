'use client'
import { useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useSyncStore } from "@/stores/syncStore"
import { useAuthStore } from "@/stores/authStore"
import { Send, Loader2, AlertTriangle, WifiOff } from "lucide-react"

export function AIPanel() {
  const { t } = useTranslation()
  const { isOnline } = useSyncStore()
  const { user } = useAuthStore()
  const [messages, setMessages] = useState<{role:string,content:string}[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [agentStatus, setAgentStatus] = useState("IDLE")

  // Offline gate
  if (!isOnline) return <OfflineState />
  // Permission gate
  if (user?.role !== "org_admin") return <AccessDenied />

  const handleSend = async () => {
    if (!input.trim() || streaming) return
    const userMsg = { role: "user", content: input }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setStreaming(true)
    setAgentStatus("UNDERSTANDING")

    let currentResponse = ""
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ messages: [...messages, userMsg], sessionId: "demo" }),
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === "status") setAgentStatus(data.status)
            if (data.type === "delta") currentResponse += data.content
          } catch {}
        }
      }
    }
    setMessages(prev => [...prev, { role: "assistant", content: currentResponse }])
    setStreaming(false)
    setAgentStatus("IDLE")
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-graph-line">
        <h3 className="font-display text-sm font-semibold text-lake-deep">{t("ai.title", "Architecte IA")}</h3>
        <p className="text-xs text-pencil">{agentStatus}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-pencil italic">
            Décrivez un processus opérationnel. Exemple: &quot;Crée un workflow de distribution alimentaire...&quot;
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`rounded-lg p-3 text-sm ${m.role === "user" ? "bg-graph-paper ml-8" : "bg-kivu-paper mr-8 border border-graph-line"}`}>
            {m.content}
          </div>
        ))}
        {streaming && <div className="flex items-center gap-2 text-xs text-pencil"><Loader2 className="h-3 w-3 animate-spin" />{agentStatus}</div>}
      </div>
      <div className="border-t border-graph-line p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Décrivez votre workflow..."
            className="flex-1 h-10 rounded-md border border-graph-line px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lake-deep"
            disabled={streaming}
          />
          <button onClick={handleSend} disabled={streaming || !input.trim()} className="h-10 w-10 flex items-center justify-center rounded-md bg-lake-deep text-white disabled:opacity-50">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function OfflineState() { return <div className="flex flex-col items-center justify-center h-full p-4 text-pencil"><WifiOff className="h-8 w-8 mb-2" /><p className="text-sm">Hors ligne</p><p className="text-xs">L&apos;assistant IA nécessite une connexion</p></div> }
function AccessDenied() { return <div className="flex flex-col items-center justify-center h-full p-4 text-pencil"><AlertTriangle className="h-8 w-8 mb-2" /><p className="text-sm">Accès réservé</p><p className="text-xs">Administrateurs uniquement</p></div> }
