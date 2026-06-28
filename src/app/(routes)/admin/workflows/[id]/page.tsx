"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useParams, useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useWorkflowStore } from "@/stores/workflowStore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ArrowRight, Plus, Trash2, Save, Send, Sparkles, X } from "lucide-react"
import { FieldPalette } from "@/components/builder/FieldPalette"
import { FormCanvas } from "@/components/builder/FormCanvas"
import { FieldEditor } from "@/components/builder/FieldEditor"
import { WorkflowFlow } from "@/components/builder/WorkflowFlow"
import { FormPreview } from "@/components/builder/FormPreview"
import { AgentStatusBar } from "@/components/ai/AgentStatusBar"
import { QuestionCard } from "@/components/ai/QuestionCard"
import { useAgentStore } from "@/stores/agentStore"
import type { DemoUser } from "@/types/auth"
import type { WorkflowDefinition } from "@/types/workflow"

const MODE_TABS = [
  { key: "fields", icon: "📋", labelKey: "workflow.fields" },
  { key: "flow", icon: "🔀", labelKey: "workflow.flow" },
  { key: "roles", icon: "👥", labelKey: "workflow.roles" },
  { key: "settings", icon: "⚙", labelKey: "workflow.settings" },
  { key: "preview", icon: "📱", labelKey: "workflow.preview" },
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

function isEnglish(language?: string) {
  return language?.startsWith("en") ?? false
}

function localizedLabel(item: { label: string; labelEn?: string }, english: boolean) {
  return english ? item.labelEn || item.label : item.label
}

function createDraftWorkflow(id: string, user: DemoUser, translate: (key: string) => string): WorkflowDefinition {
  const now = new Date().toISOString()
  return {
    id,
    orgId: user.orgId,
    version: 1,
    name: "Nouveau workflow",
    nameEn: translate("workflow.newDefaultName"),
    description: "",
    descriptionEn: "",
    entity: {
      id: "entity-1",
      key: "record",
      label: "Fiche",
      labelEn: translate("workflow.defaultEntity"),
      fields: [],
    },
    states: [
      {
        id: "state-draft",
        key: "draft",
        label: "Brouillon",
        labelEn: translate("workflow.stateDraft"),
        color: "#6B7280",
        isInitial: true,
        isTerminal: false,
        x: 160,
        y: 120,
      },
      {
        id: "state-submitted",
        key: "submitted",
        label: "Soumis",
        labelEn: translate("workflow.stateSubmitted"),
        color: "#2563EB",
        isInitial: false,
        isTerminal: false,
        x: 420,
        y: 120,
      },
    ],
    transitions: [
      {
        id: "transition-submit",
        key: "submit",
        label: "Soumettre",
        labelEn: translate("workflow.transitionSubmit"),
        fromState: "state-draft",
        toState: "state-submitted",
        requiredRoles: ["field_worker"],
      },
    ],
    roles: [
      { id: "role-field-worker", key: "field_worker", label: "Agent terrain", labelEn: translate("roles.field_worker"), permissions: ["record:create", "record:read_own", "record:update_own", "sync:push", "sync:pull"] },
      { id: "role-supervisor", key: "supervisor", label: "Superviseur", labelEn: translate("roles.supervisor"), permissions: ["record:read_team", "record:verify", "record:approve", "conflict:resolve", "sync:pull"] },
      { id: "role-admin", key: "org_admin", label: "Administrateur", labelEn: translate("roles.org_admin"), permissions: ["workflow:publish", "admin:manage_users", "audit:view"] },
    ],
    offlinePolicy: {
      maxOfflineHours: 72,
      allowedOperations: { create: true, update: true, delete: false, evidence: true },
      conflictStrategy: "manual",
      manualResolutionFields: [],
      autoResolutionNumeric: "max",
      maxAttachmentSizeMb: 10,
      allowedAttachmentTypes: ["image/jpeg", "image/png", "application/pdf"],
      attachmentSyncPriority: "deferred",
    },
    status: "draft",
    createdAt: now,
    updatedAt: now,
    author: user.email,
  }
}

function StatePropertiesPanel() {
  const { t, i18n } = useTranslation()
  const { workflow, selectedStateId, updateState } = useWorkflowStore()
  const state = workflow?.states.find((s) => s.id === selectedStateId)
  const english = isEnglish(i18n.resolvedLanguage || i18n.language)

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
        <p className="text-sm font-medium text-ink-black mt-1">{localizedLabel(state, english)}</p>
      </div>
      <div>
        <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("workflow.key")}</label>
        <p className="font-mono text-sm text-volcanic-ash mt-1">{state.key}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded" style={{ backgroundColor: state.color }} />
        <span className="text-sm text-ink-black">{state.color}</span>
      </div>
      <div className="flex gap-2">
        <Badge variant={state.isInitial ? "info" : "default"} size="sm">
          {state.isInitial ? t("workflow.initial") : ""}
        </Badge>
        <Badge variant={state.isTerminal ? "success" : "default"} size="sm">
          {state.isTerminal ? t("workflow.terminal") : ""}
        </Badge>
      </div>
    </div>
  )
}

export default function WorkflowBuilder() {
  const { t, i18n } = useTranslation()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const { workflow, setWorkflow, updateWorkflow, addState, removeState, removeTransition, publish } = useWorkflowStore()
  const agentPhase = useAgentStore((s) => s.phase)
  const startGeneration = useAgentStore((s) => s.startGeneration)

  const [activeMode, setActiveMode] = useState("fields")
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [publishConfirm, setPublishConfirm] = useState(false)
  const [loadingWorkflow, setLoadingWorkflow] = useState(true)
  const [aiPromptOpen, setAiPromptOpen] = useState(false)
  const [aiPromptText, setAiPromptText] = useState("")
  const english = isEnglish(i18n.resolvedLanguage || i18n.language)

  useEffect(() => {
    if (!params.id || !user || user.role !== "org_admin") return
    if (workflow?.id === params.id) {
      setLoadingWorkflow(false)
      return
    }
    let cancelled = false
    setLoadingWorkflow(true)
    fetch(`/api/workflows/${params.id}/definition`, { credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled) return
        setWorkflow(data ?? createDraftWorkflow(params.id, user, (key) => t(key)))
      })
      .catch(() => {
        if (!cancelled) setWorkflow(createDraftWorkflow(params.id, user, (key) => t(key)))
      })
      .finally(() => {
        if (!cancelled) setLoadingWorkflow(false)
      })
    return () => { cancelled = true }
  }, [params.id, workflow?.id, user, setWorkflow, t])

  useEffect(() => {
    if (!user || user.role !== "org_admin") router.push("/")
  }, [user, router])

  const { selectedStateId } = useWorkflowStore()

  const stateColor = (key: string) => STATE_COLORS[key] ?? "#6B7280"

  const persistWorkflow = async () => {
    const currentWorkflow = useWorkflowStore.getState().workflow
    if (!currentWorkflow) return null
    const updatedWorkflow = { ...currentWorkflow, updatedAt: new Date().toISOString() }
    const res = await fetch(`/api/workflows/${updatedWorkflow.id}/definition`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updatedWorkflow),
    })
    if (!res.ok) throw new Error("SAVE_FAILED")
    const saved = await res.json()
    setWorkflow(saved)
    setLastSaved(new Date())
    return saved as WorkflowDefinition
  }

  const handleSave = async () => {
    try {
      await persistWorkflow()
    } catch {
      updateWorkflow({ updatedAt: new Date().toISOString() })
    }
  }

  const handlePublish = async () => {
    await persistWorkflow()
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

  const submitAiPrompt = () => {
    const prompt = aiPromptText.trim()
    if (!prompt || agentPhase !== "idle" || !workflow) return
    startGeneration(prompt, workflow)
    setAiPromptText("")
    setAiPromptOpen(false)
  }

  if (!user || user.role !== "org_admin") return null
  if (loadingWorkflow || !workflow) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-md border border-graph-line bg-white p-8">
        <p className="text-sm text-pencil">{t("workflow.loading")}</p>
      </div>
    )
  }

  const workflowName = english ? workflow.nameEn || workflow.name : workflow.name

  return (
    <div className="flex h-[calc(100vh-6.5rem)] min-h-[620px] flex-col overflow-hidden rounded-lg border border-graph-line bg-slate-50 shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-graph-line bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <button
            onClick={handleBack}
            className="min-h-9 text-sm text-volcanic-ash transition-colors hover:text-lake-deep"
          >
            ← {t("workflow.builder", "Workflows")}
          </button>
          <span className="hidden text-volcanic-ash/30 sm:inline">|</span>
          <span className="min-w-0 truncate font-display text-lg tracking-tight text-lake-deep sm:text-xl">
            {workflowName}
          </span>
          <Badge variant={workflow.status === "published" ? "success" : "default"} size="sm">
            {workflow.status === "published" ? t("workflow.published", "Publié") : t("workflow.draft", "Brouillon")}
          </Badge>
          <span className="font-mono text-xs text-volcanic-ash">v{workflow.version}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {lastSaved && (
            <span className="w-full text-[10px] text-pencil/60 sm:w-auto">
              {t("admin.saved", "Sauvegardé")} {lastSaved.toLocaleTimeString(english ? "en-US" : "fr-FR", { hour: "2-digit", minute: "2-digit" })}
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
            onClick={() => setAiPromptOpen(true)}
            className={`p-2 rounded-md transition-colors ${agentPhase !== "idle" ? "bg-clay/10 text-clay" : "text-pencil hover:text-clay"}`}
            title={t("workflow.aiAssistant")}
          >
            <Sparkles size={18} />
          </button>
        </div>
      </div>

      {/* Publish Confirmation */}
      {publishConfirm && (
        <div className="flex flex-col gap-3 border-b border-warning-500/20 bg-warning-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-black">
            {t("admin.publishConfirm", "Publier une nouvelle version ? Cette action créera une version immuable.")}
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPublishConfirm(false)}>
              {t("common.cancel", "Annuler")}
            </Button>
            <Button variant="primary" size="sm" onClick={handlePublish}>
              {t("workflow.publish", "Publier")}
            </Button>
          </div>
        </div>
      )}

      {/* AI Status Bar */}
      <AgentStatusBar />

      {/* Content */}
      <div className="relative flex flex-1 overflow-hidden bg-slate-50">
        {aiPromptOpen && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl border border-graph-line bg-white p-5 shadow-2xl sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-2xl font-semibold tracking-tight text-ink-black">
                    {t("workflow.aiAssistant")}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-pencil">
                    {t("workflow.aiPromptHelp")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAiPromptOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
                  aria-label={t("common.close")}
                >
                  <X size={18} />
                </button>
              </div>
              <Textarea
                value={aiPromptText}
                onChange={(event) => setAiPromptText(event.target.value)}
                placeholder={t("workflow.aiPrompt")}
                className="min-h-40 resize-none bg-white text-base leading-6"
                autoFocus
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault()
                    submitAiPrompt()
                  }
                }}
              />
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-pencil">
                  {t("workflow.aiPromptHint")}
                </p>
                <div className="flex gap-2 sm:justify-end">
                  <Button variant="secondary" size="md" onClick={() => setAiPromptOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={submitAiPrompt}
                    disabled={!aiPromptText.trim() || agentPhase !== "idle"}
                  >
                    <Sparkles size={16} />
                    {t("workflow.aiGenerate")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        <QuestionCard />
        {activeMode === "fields" && (
          <div className="flex flex-1 overflow-hidden bg-slate-50">
            <aside className="w-56 border-r border-graph-line bg-white overflow-y-auto shrink-0">
              <FieldPalette />
            </aside>
            <FormCanvas />
            <aside className="w-80 border-l border-graph-line bg-white overflow-y-auto shrink-0">
              <FieldEditor />
            </aside>
          </div>
        )}

        {activeMode === "flow" && (
          <div className="flex flex-1 overflow-hidden bg-slate-50">
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
                            : "hover:bg-graph-paper border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stateColor(state.key) }} />
                          <span className="text-ink-black truncate">{localizedLabel(state, english)}</span>
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
                          <span className="text-ink-black truncate">{from ? localizedLabel(from, english) : "?"}</span>
                          <ArrowRight size={12} className="text-clay shrink-0" />
                          <span className="text-ink-black truncate">{to ? localizedLabel(to, english) : "?"}</span>
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
          <div className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-8">
            <div className="mx-auto max-w-5xl">
              <div className="mb-5 rounded-lg border border-graph-line bg-white px-5 py-4 shadow-sm">
                <h2 className="font-display text-2xl tracking-tight text-lake-deep">{t("workflow.roles", "Rôles")}</h2>
                <p className="mt-1 text-sm text-pencil">
                  {t("workflow.rolesHelp", "Review who can collect, approve, publish, and resolve work in this workflow.")}
                </p>
              </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {workflow.roles.map((role) => (
                <div key={role.id} className="rounded-lg border border-graph-line bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-ink-black">{localizedLabel(role, english)}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {role.permissions.map((perm) => (
                      <span
                        key={perm}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.04em] text-slate-600"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}

        {activeMode === "settings" && (
          <div className="flex-1 overflow-y-auto bg-slate-50 p-6 lg:p-8">
            <div className="mx-auto max-w-3xl">
              <div className="mb-5 rounded-lg border border-graph-line bg-white px-5 py-4 shadow-sm">
                <h2 className="font-display text-2xl tracking-tight text-lake-deep">{t("workflow.settings", "Paramètres")}</h2>
                <p className="mt-1 text-sm text-pencil">
                  {t("workflow.settingsHelp", "Version and publication details for the current workflow draft.")}
                </p>
              </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-graph-line bg-white p-4 shadow-sm">
                <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.version", "Version")}</label>
                <p className="font-display text-2xl text-lake-deep mt-1">v{workflow.version}</p>
              </div>
              <div className="rounded-lg border border-graph-line bg-white p-4 shadow-sm">
                <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.status", "Statut")}</label>
                <p className="text-sm text-ink-black mt-1">{workflow.status === "published" ? t("workflow.published") : t("workflow.draft")}</p>
              </div>
              {workflow.publishedAt && (
                <div className="rounded-lg border border-graph-line bg-white p-4 shadow-sm sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.publishedOn", "Publié le")}</label>
                  <p className="text-sm text-ink-black mt-1">
                    {new Date(workflow.publishedAt).toLocaleDateString(english ? "en-US" : "fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
              )}
            </div>
            </div>
          </div>
        )}

        {activeMode === "preview" && (
          <div className="flex-1 overflow-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
            <div className="flex min-h-full items-start justify-center py-3">
              <FormPreview />
            </div>
          </div>
        )}
      </div>

      {/* Mode Tabs */}
      <div className="flex overflow-x-auto border-t border-graph-line bg-white">
        {MODE_TABS.map(({ key, icon, labelKey }) => (
          <button
            key={key}
            onClick={() => setActiveMode(key)}
            className={`min-w-28 flex-1 px-3 py-3 text-sm font-medium transition-colors ${
              activeMode === key
                ? "border-t-2 border-ink-blue text-ink-blue bg-ink-blue/5"
                : "border-t-2 border-transparent text-pencil hover:text-ink-black"
            }`}
          >
            <span aria-hidden="true">{icon}</span> {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
