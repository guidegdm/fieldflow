"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useParams, useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useWorkflowStore } from "@/stores/workflowStore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Plus, Trash2, Save, Send, X, Sparkles } from "lucide-react"
import { FieldPalette } from "@/components/builder/FieldPalette"
import { FormCanvas } from "@/components/builder/FormCanvas"
import { FieldEditor } from "@/components/builder/FieldEditor"
import { WorkflowFlow } from "@/components/builder/WorkflowFlow"
import { FormPreview } from "@/components/builder/FormPreview"
import type { WorkflowDefinition } from "@/types/workflow"

const DEMO_WORKFLOW: WorkflowDefinition = {
  id: "wf-1",
  version: 3,
  name: "Enregistrement et Distribution Humanitaire",
  nameEn: "Humanitarian Registration & Distribution",
  description: "Workflow de bout en bout pour l'enregistrement et la distribution d'aide humanitaire",
  descriptionEn: "End-to-end workflow for humanitarian registration and aid distribution",
  entity: {
    id: "ent-1",
    key: "household",
    label: "Ménage",
    labelEn: "Household",
    fields: [
      { id: "f-1", key: "head_name", label: "Chef de ménage", labelEn: "Head of Household", type: "text", required: true, order: 0, section: "default" },
      { id: "f-2", key: "size", label: "Taille du ménage", labelEn: "Household Size", type: "number", required: true, order: 1, section: "default" },
      { id: "f-3", key: "village", label: "Village", labelEn: "Village", type: "text", required: true, order: 2, section: "default" },
      { id: "f-4", key: "shelter", label: "Type d'abri", labelEn: "Shelter Type", type: "select", required: false, order: 3, section: "default", options: [{ label: "Tente", value: "tent" }, { label: "Brique", value: "brick" }, { label: "Abri temporaire", value: "temporary" }] },
      { id: "f-5", key: "vulnerability", label: "Score de vulnérabilité", labelEn: "Vulnerability Score", type: "number", required: true, order: 4, section: "assessment" },
      { id: "f-6", key: "gps", label: "Coordonnées GPS", labelEn: "GPS Coordinates", type: "gps", required: false, order: 5, section: "assessment" },
      { id: "f-7", key: "photo", label: "Photo du chef", labelEn: "Head Photo", type: "photo", required: false, order: 6, section: "evidence" },
      { id: "f-8", key: "notes", label: "Notes", labelEn: "Notes", type: "textarea", required: false, order: 7, section: "notes" },
    ],
  },
  states: [
    { id: "st-1", key: "brouillon", label: "Brouillon", labelEn: "Draft", color: "#6B7280", isInitial: true, isTerminal: false, x: 60, y: 80 },
    { id: "st-2", key: "soumis", label: "Soumis", labelEn: "Submitted", color: "#D97706", isInitial: false, isTerminal: false, x: 260, y: 80 },
    { id: "st-3", key: "verifie", label: "Vérifié", labelEn: "Verified", color: "#2563EB", isInitial: false, isTerminal: false, x: 460, y: 80 },
    { id: "st-4", key: "approuve", label: "Approuvé", labelEn: "Approved", color: "#16A34A", isInitial: false, isTerminal: false, x: 660, y: 80 },
    { id: "st-5", key: "reserve", label: "Réservé", labelEn: "Reserved", color: "#C17A4E", isInitial: false, isTerminal: false, x: 460, y: 260 },
    { id: "st-6", key: "distribue", label: "Distribué", labelEn: "Distributed", color: "#059669", isInitial: false, isTerminal: false, x: 260, y: 260 },
    { id: "st-7", key: "confirme", label: "Confirmé", labelEn: "Confirmed", color: "#1B4F72", isInitial: false, isTerminal: true, x: 60, y: 260 },
  ],
  transitions: [
    { id: "tr-1", key: "soumettre", label: "Soumettre", labelEn: "Submit", fromState: "st-1", toState: "st-2", requiredRoles: ["field_worker"] },
    { id: "tr-2", key: "verifier", label: "Vérifier", labelEn: "Verify", fromState: "st-2", toState: "st-3", requiredRoles: ["supervisor"] },
    { id: "tr-3", key: "approuver", label: "Approuver", labelEn: "Approve", fromState: "st-3", toState: "st-4", requiredRoles: ["supervisor"] },
    { id: "tr-4", key: "reserver", label: "Réserver inventaire", labelEn: "Reserve Inventory", fromState: "st-4", toState: "st-5", requiredRoles: ["supervisor"], sideEffects: ["inventory_reserve"] },
    { id: "tr-5", key: "distribuer", label: "Distribuer", labelEn: "Distribute", fromState: "st-5", toState: "st-6", requiredRoles: ["field_worker", "supervisor"] },
    { id: "tr-6", key: "confirmer", label: "Confirmer réception", labelEn: "Confirm Receipt", fromState: "st-6", toState: "st-7", requiredRoles: ["field_worker"] },
  ],
  roles: [
    { id: "rl-1", key: "field_worker", label: "Agent terrain", permissions: ["create", "update_own", "sync", "distribute"] },
    { id: "rl-2", key: "supervisor", label: "Superviseur", permissions: ["verify", "approve", "reject", "reserve", "manage_conflicts", "view_all"] },
    { id: "rl-3", key: "org_admin", label: "Administrateur", permissions: ["manage_workflows", "manage_users", "publish", "view_all", "export"] },
  ],
  offlinePolicy: {
    maxOfflineHours: 72,
    allowedOperations: { create: true, update: true, delete: false, evidence: true },
    conflictStrategy: "manual",
    manualResolutionFields: ["head_name", "size", "village"],
    autoResolutionNumeric: "average",
    maxAttachmentSizeMb: 10,
    allowedAttachmentTypes: ["image/jpeg", "image/png", "application/pdf"],
    attachmentSyncPriority: "low",
  },
  status: "draft",
  createdAt: "2025-11-01T08:00:00Z",
  updatedAt: "2026-06-25T14:30:00Z",
  publishedAt: undefined,
  author: "Céline M.",
}

const MODE_TABS = [
  { key: "fields", label: "📋 Fields" },
  { key: "flow", label: "🔀 Flow" },
  { key: "roles", label: "👥 Roles" },
  { key: "settings", label: "⚙ Settings" },
  { key: "preview", label: "📱 Preview" },
]

const STATE_COLORS: Record<string, string> = {
  brouillon: "#6B7280",
  soumis: "#D97706",
  verifie: "#2563EB",
  approuve: "#16A34A",
  reserve: "#C17A4E",
  distribue: "#059669",
  confirme: "#1B4F72",
}

function StatePropertiesPanel() {
  const { t } = useTranslation()
  const { workflow, selectedStateId, updateState } = useWorkflowStore()
  const state = workflow?.states.find((s) => s.id === selectedStateId)

  if (!state) {
    return (
      <div className="p-6">
        <p className="text-sm text-pencil italic">{t("admin.noSelection", "Sélectionnez un état")}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-[11px] uppercase tracking-[0.15em] text-soil font-semibold">
        {t("admin.properties", "Propriétés")}
      </h3>
      <div>
        <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.stateLabel", "Label")}</label>
        <p className="text-sm font-medium text-ink-black mt-1">{state.label}</p>
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{"Clé"}</label>
        <p className="font-mono text-sm text-volcanic-ash mt-1">{state.key}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded" style={{ backgroundColor: state.color }} />
        <span className="text-sm text-ink-black">{state.color}</span>
      </div>
      <div className="flex gap-2">
        <Badge variant={state.isInitial ? "info" : "default"} size="sm">
          {state.isInitial ? "Initial" : ""}
        </Badge>
        <Badge variant={state.isTerminal ? "success" : "default"} size="sm">
          {state.isTerminal ? "Terminal" : ""}
        </Badge>
      </div>
    </div>
  )
}

function AIPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState("")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setResponse("")

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      })

      if (!res.ok) {
        setResponse("Erreur de connexion à l'assistant.")
        return
      }

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const parsed = JSON.parse(line.slice(6))
              setResponse((prev) => prev + (parsed.text || ""))
            } catch { /* skip malformed */ }
          }
        }
      }
    } catch {
      setResponse("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-black flex items-center gap-2">
          <Sparkles size={16} className="text-clay" />
          {"Assistant IA"}
        </h3>
        <button onClick={onClose} className="text-pencil/40 hover:text-ink-black transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          placeholder={t("admin.aiPrompt", "Décrivez le formulaire dont vous avez besoin...")}
          className="flex-1 h-10 rounded-md border border-[#CBD5E1] px-3 py-2 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue"
        />
        <Button variant="primary" size="sm" onClick={handleGenerate} loading={loading}>
          {t("admin.generate", "Générer")}
        </Button>
      </div>
      {response && (
        <div className="mt-3 p-3 rounded-md bg-gray-50 border border-graph-line text-sm text-ink-black whitespace-pre-wrap">
          {response}
        </div>
      )}
    </div>
  )
}

export default function WorkflowBuilder() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const { workflow, setWorkflow, updateWorkflow, addState, removeState, addTransition, removeTransition, publish } = useWorkflowStore()

  const [activeMode, setActiveMode] = useState("fields")
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [publishConfirm, setPublishConfirm] = useState(false)

  useEffect(() => {
    if (params.id && !workflow) setWorkflow(DEMO_WORKFLOW)
  }, [params.id, workflow, setWorkflow])

  useEffect(() => {
    if (!user || user.role !== "org_admin") router.push("/")
  }, [user, router])

  const { selectedStateId } = useWorkflowStore()

  const stateColor = (key: string) => STATE_COLORS[key] ?? "#6B7280"

  const visibleTransitions = useMemo(() => {
    if (!workflow) return []
    return workflow.transitions
  }, [workflow])

  const handleSave = () => {
    updateWorkflow({ updatedAt: new Date().toISOString() })
    setLastSaved(new Date())
  }

  const handlePublish = async () => {
    await publish()
    setPublishConfirm(false)
    setLastSaved(new Date())
  }

  const handleBack = () => {
    if (workflow && !publishConfirm) {
      const unsaved = lastSaved === null || (
        workflow.updatedAt && new Date(workflow.updatedAt).getTime() > lastSaved.getTime()
      )
      if (unsaved && !window.confirm(t("admin.unsavedConfirm", "Des modifications non sauvegardées seront perdues. Quitter quand même ?")))
        return
    }
    router.push("/admin/workflows")
  }

  if (!user || user.role !== "org_admin") return null
  if (!workflow) return null

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-8 bg-kivu-paper">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b-2 border-volcanic-ash/30 bg-white">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="text-sm text-volcanic-ash hover:text-lake-deep transition-colors"
          >
            ← {t("workflow.builder", "Workflows")}
          </button>
          <span className="text-volcanic-ash/30">|</span>
          <span className="font-display text-xl text-lake-deep tracking-tight">
            {workflow.name}
          </span>
          <Badge variant={workflow.status === "published" ? "success" : "default"} size="sm">
            {workflow.status === "published" ? t("workflow.published", "Publié") : t("workflow.draft", "Brouillon")}
          </Badge>
          <span className="font-mono text-xs text-volcanic-ash">v{workflow.version}</span>
        </div>
        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-[10px] text-pencil/60">
              {t("admin.saved", "Sauvegardé")} {lastSaved.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
          >
            <Save size={14} /> {t("common.save", "Sauvegarder")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setPublishConfirm(true)}
          >
            <Send size={14} /> {t("workflow.publish", "Publier")}
          </Button>
          <button
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
            className={`p-2 rounded-md transition-colors ${aiPanelOpen ? "bg-clay/10 text-clay" : "text-pencil hover:text-clay"}`}
            title="Assistant IA"
          >
            <Sparkles size={18} />
          </button>
        </div>
      </div>

      {/* Publish Confirmation */}
      {publishConfirm && (
        <div className="px-6 py-3 bg-warning-500/5 border-b border-warning-500/20 flex items-center justify-between">
          <p className="text-sm text-ink-black">
            {t("admin.publishConfirm", "Publier une nouvelle version ? Cette action créera une version immuable.")}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPublishConfirm(false)}>
              {t("common.cancel", "Annuler")}
            </Button>
            <Button variant="primary" size="sm" onClick={handlePublish}>
              {t("workflow.publish", "Publier")}
            </Button>
          </div>
        </div>
      )}

      {/* AI Panel */}
      {aiPanelOpen && (
        <div className="border-b border-graph-line bg-white">
          <AIPanel onClose={() => setAiPanelOpen(false)} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeMode === "fields" && (
          <div className="flex flex-1 overflow-hidden">
            <aside className="w-56 border-r border-graph-line bg-white overflow-y-auto shrink-0">
              <FieldPalette onOpenAI={() => setAiPanelOpen(!aiPanelOpen)} />
            </aside>
            <FormCanvas />
            <aside className="w-80 border-l border-graph-line bg-white overflow-y-auto shrink-0">
              <FieldEditor />
            </aside>
          </div>
        )}

        {activeMode === "flow" && (
          <div className="flex flex-1 overflow-hidden">
            <aside className="w-56 border-r border-graph-line bg-white overflow-y-auto p-4 shrink-0">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] uppercase tracking-[0.15em] text-soil font-semibold">{t("workflow.states", "États")}</h3>
                    <button onClick={addState} className="text-volcanic-ash hover:text-lake-deep transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {workflow.states.map((state) => (
                      <div
                        key={state.id}
                        onClick={() => useWorkflowStore.setState({ selectedStateId: state.id })}
                        className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                          selectedStateId === state.id
                            ? "bg-clay/10 border border-clay/30"
                            : "hover:bg-gray-50 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stateColor(state.key) }} />
                          <span className="text-ink-black truncate">{state.label}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeState(state.id) }}
                          className="text-volcanic-ash/50 hover:text-rebar transition-colors shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] uppercase tracking-[0.15em] text-soil font-semibold mb-3">{t("workflow.transitions", "Transitions")}</h3>
                  <div className="space-y-1">
                    {workflow.transitions.map((tr) => {
                      const from = workflow.states.find((s) => s.id === tr.fromState)
                      const to = workflow.states.find((s) => s.id === tr.toState)
                      return (
                        <div key={tr.id} className="flex items-center gap-2 px-3 py-2 text-xs text-volcanic-ash">
                          <span className="text-ink-black truncate">{from?.label ?? "?"}</span>
                          <ArrowRight size={12} className="text-clay shrink-0" />
                          <span className="text-ink-black truncate">{to?.label ?? "?"}</span>
                          <button
                            onClick={() => removeTransition(tr.id)}
                            className="ml-auto text-volcanic-ash/50 hover:text-rebar transition-colors shrink-0"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </aside>
            <WorkflowFlow />
            <aside className="w-80 border-l border-graph-line bg-white overflow-y-auto shrink-0">
              <StatePropertiesPanel />
            </aside>
          </div>
        )}

        {activeMode === "roles" && (
          <div className="flex-1 overflow-y-auto p-8">
            <h2 className="font-display text-xl text-lake-deep tracking-tight mb-6">{t("workflow.roles", "Rôles")}</h2>
            <div className="space-y-3 max-w-2xl">
              {workflow.roles.map((role) => (
                <div key={role.id} className="p-4 rounded-md border border-graph-line bg-white">
                  <p className="text-sm font-medium text-ink-black">{role.label}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {role.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="text-[10px] uppercase tracking-[0.05em] bg-kivu-paper text-volcanic-ash px-1.5 py-0.5 rounded"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeMode === "settings" && (
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <h2 className="font-display text-xl text-lake-deep tracking-tight mb-6">{t("workflow.settings", "Paramètres")}</h2>
            <div className="max-w-xl space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.version", "Version")}</label>
                <p className="font-display text-2xl text-lake-deep mt-1">v{workflow.version}</p>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.status", "Statut")}</label>
                <p className="text-sm text-ink-black mt-1 capitalize">{workflow.status}</p>
              </div>
              {workflow.publishedAt && (
                <div>
                  <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.publishedOn", "Publié le")}</label>
                  <p className="text-sm text-ink-black mt-1">
                    {new Date(workflow.publishedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeMode === "preview" && (
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-kivu-paper">
            <FormPreview />
          </div>
        )}
      </div>

      {/* Mode Tabs */}
      <div className="border-t border-graph-line bg-white flex">
        {MODE_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveMode(key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeMode === key
                ? "border-t-2 border-ink-blue text-ink-blue bg-ink-blue/5"
                : "border-t-2 border-transparent text-pencil hover:text-ink-black"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
