"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useParams, useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useWorkflowStore } from "@/stores/workflowStore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { ArrowRight, Plus, Trash2, Save, Send, Sparkles, X } from "lucide-react"
import { FieldPalette } from "@/components/builder/FieldPalette"
import { FormCanvas } from "@/components/builder/FormCanvas"
import { FieldEditor } from "@/components/builder/FieldEditor"
import { WorkflowFlow } from "@/components/builder/WorkflowFlow"
import { FormPreview } from "@/components/builder/FormPreview"
import { AgentStatusBar } from "@/components/ai/AgentStatusBar"
import { QuestionCard } from "@/components/ai/QuestionCard"
import { useAgentStore } from "@/stores/agentStore"
import { db } from "@/lib/db/indexeddb"
import { invalidate } from "@/lib/invalidation"
import { requestPipelineSync } from "@/lib/sync/pipeline-coordinator"
import { registerFieldFlowBackgroundSync } from "@/lib/sync/register-background-sync"
import { useSyncStore } from "@/stores/syncStore"
import type { DemoUser } from "@/types/auth"
import type { MutationEntry } from "@/types/sync"
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
  const { workflow, setWorkflow, updateWorkflow, addState, removeState, addTransition, removeTransition } = useWorkflowStore()
  const agentPhase = useAgentStore((s) => s.phase)
  const startGeneration = useAgentStore((s) => s.startGeneration)

  const [activeMode, setActiveMode] = useState("fields")
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [publishConfirm, setPublishConfirm] = useState(false)
  const [loadingWorkflow, setLoadingWorkflow] = useState(true)
  const [aiPromptOpen, setAiPromptOpen] = useState(false)
  const [aiPromptText, setAiPromptText] = useState("")
  const [transitionFrom, setTransitionFrom] = useState("")
  const [transitionTo, setTransitionTo] = useState("")
  const [transitionRole, setTransitionRole] = useState("supervisor")
  const english = isEnglish(i18n.resolvedLanguage || i18n.language)

  useEffect(() => {
    if (!params.id || !user || user.role !== "org_admin") return
    const currentUser = user
    if (workflow?.id === params.id) {
      setLoadingWorkflow(false)
      return
    }
    let cancelled = false
    setLoadingWorkflow(true)

    async function loadWorkflow() {
      try {
        const res = await fetch(`/api/workflows/${params.id}/definition`, { credentials: "include" })
        const data = res.ok ? await res.json() as WorkflowDefinition : null
        if (cancelled) return
        if (data) {
          setWorkflow(data)
          await db.saveWorkflow(data)
          return
        }
      } catch {}

      const local = await db.getWorkflow(params.id).catch(() => undefined)
      if (cancelled) return
      const next = local ?? createDraftWorkflow(params.id, currentUser, (key) => t(key))
      setWorkflow(next)
      if (!local) await db.saveWorkflow(next).catch(() => {})
    }

    loadWorkflow().finally(() => {
        if (!cancelled) setLoadingWorkflow(false)
      })
    return () => { cancelled = true }
  }, [params.id, workflow?.id, user, setWorkflow, t])

  useEffect(() => {
    if (!user || user.role !== "org_admin") router.push("/")
  }, [user, router])

  const { selectedStateId, selectedFieldId } = useWorkflowStore()

  const stateColor = (key: string) => STATE_COLORS[key] ?? "#6B7280"

  const queueWorkflowDefinition = async (nextWorkflow: WorkflowDefinition, reason: string) => {
    if (!user?.orgId) return nextWorkflow
    const deviceId = user.deviceId || "workflow-builder"
    const mutation: MutationEntry = {
      client_id: `workflow-${nextWorkflow.id}-${nextWorkflow.status}-${nextWorkflow.version}-${Date.now()}`,
      device_id: deviceId,
      operation: "workflow_definition",
      resource: "workflow",
      workflow_id: nextWorkflow.id,
      record_id: null,
      payload: nextWorkflow,
      client_timestamp: Date.now(),
      base_version: Math.max(0, nextWorkflow.version - (nextWorkflow.status === "published" ? 1 : 0)),
      base_fields: {},
      status: "PENDING",
      retry_count: 0,
      last_error: null,
      enqueued_at: Date.now(),
    }
    await db.saveWorkflow(nextWorkflow)
    await db.enqueueMutation(mutation)
    void registerFieldFlowBackgroundSync()
    useSyncStore.getState().setPendingCount((await db.getPendingMutations()).length)
    setWorkflow(nextWorkflow)
    invalidate(["workflows", "sync"])
    setLastSaved(new Date())
    void requestPipelineSync(user, { reason, retry: true })
    return nextWorkflow
  }

  const persistWorkflow = async () => {
    const currentWorkflow = useWorkflowStore.getState().workflow
    if (!currentWorkflow) return null
    const updatedWorkflow = { ...currentWorkflow, orgId: user?.orgId || currentWorkflow.orgId, updatedAt: new Date().toISOString() }
    return queueWorkflowDefinition(updatedWorkflow as WorkflowDefinition, "workflow-save")
  }

  const handleSave = async () => {
    try {
      await persistWorkflow()
    } catch {
      const currentWorkflow = useWorkflowStore.getState().workflow
      if (!currentWorkflow) return
      const updatedWorkflow = { ...currentWorkflow, updatedAt: new Date().toISOString() }
      await db.saveWorkflow(updatedWorkflow).catch(() => {})
      setWorkflow(updatedWorkflow)
      setLastSaved(new Date())
    }
  }

  const handlePublish = async () => {
    const currentWorkflow = useWorkflowStore.getState().workflow
    if (!currentWorkflow) return
    const now = new Date().toISOString()
    const publishedWorkflow: WorkflowDefinition = {
      ...currentWorkflow,
      orgId: user?.orgId || currentWorkflow.orgId,
      status: "published",
      version: currentWorkflow.version + 1,
      updatedAt: now,
      publishedAt: now,
    }
    await queueWorkflowDefinition(publishedWorkflow, "workflow-publish")
    invalidate(["workflows"])
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

  useEffect(() => {
    if (!workflow?.states.length) return
    setTransitionFrom((current) => current && workflow.states.some((state) => state.id === current) ? current : workflow.states[0].id)
    setTransitionTo((current) => current && workflow.states.some((state) => state.id === current) ? current : workflow.states[Math.min(1, workflow.states.length - 1)].id)
  }, [workflow?.states])

  const createTransition = () => {
    if (!workflow || !transitionFrom || !transitionTo || transitionFrom === transitionTo) return
    addTransition(transitionFrom, transitionTo, [transitionRole])
  }

  if (!user || user.role !== "org_admin") return null
  if (loadingWorkflow || !workflow) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-md border border-graph-line bg-white p-8">
        <p className="text-sm text-pencil">{t("workflow.loading")}</p>
      </div>
    )
  }

  const workflowName = workflow.name || workflow.nameEn

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col overflow-hidden rounded-lg border border-graph-line bg-slate-50 shadow-sm lg:h-[calc(100vh-6.5rem)] lg:min-h-[620px]">
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

      {/* Mode Tabs */}
      <div className="flex shrink-0 overflow-x-auto border-b border-graph-line bg-white">
        {MODE_TABS.map(({ key, icon, labelKey }) => (
          <button
            key={key}
            onClick={() => setActiveMode(key)}
            className={`min-w-24 flex-1 px-3 py-3 text-sm font-medium transition-colors sm:min-w-28 ${
              activeMode === key
                ? "border-b-2 border-ink-blue bg-ink-blue/5 text-ink-blue"
                : "border-b-2 border-transparent text-pencil hover:text-ink-black"
            }`}
          >
            <span aria-hidden="true">{icon}</span> {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-slate-50">
        {aiPromptOpen && (
          <div className="fixed inset-0 z-[80] flex min-h-dvh items-start justify-center overflow-y-auto bg-ink-black/20 px-3 py-5 backdrop-blur-sm sm:items-center sm:px-6">
            <div className="flex max-h-[calc(100dvh-2.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-graph-line bg-white shadow-2xl">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-graph-line px-5 py-4 sm:px-6">
                <div className="min-w-0">
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
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                <Textarea
                  value={aiPromptText}
                  onChange={(event) => setAiPromptText(event.target.value)}
                  placeholder={t("workflow.aiPrompt")}
                  className="min-h-48 resize-y bg-white text-base leading-6 sm:min-h-56"
                  autoFocus
                  onKeyDown={(event) => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                      event.preventDefault()
                      submitAiPrompt()
                    }
                  }}
                />
              </div>
              <div className="flex shrink-0 flex-col gap-3 border-t border-graph-line bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-xs leading-5 text-pencil">
                  {t("workflow.aiPromptHint")}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
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
          <div className="flex flex-1 flex-col overflow-y-auto bg-slate-50 lg:flex-row lg:overflow-hidden">
            <aside className="max-h-64 shrink-0 overflow-y-auto border-b border-graph-line bg-white lg:max-h-none lg:w-56 lg:border-b-0 lg:border-r">
              <FieldPalette />
            </aside>
            <FormCanvas />
            <aside className={`${selectedFieldId ? "block" : "hidden lg:block"} shrink-0 border-t border-graph-line bg-white lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0`}>
              <FieldEditor />
            </aside>
          </div>
        )}

        {activeMode === "flow" && (
          <div className="flex flex-1 flex-col overflow-y-auto bg-slate-50 lg:flex-row lg:overflow-hidden">
            <aside className="max-h-72 shrink-0 overflow-y-auto border-b border-graph-line bg-white p-4 lg:max-h-none lg:w-56 lg:border-b-0 lg:border-r">
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
                  <div className="mb-3 rounded-lg border border-graph-line bg-slate-50 p-2">
                    <p className="mb-2 text-xs leading-5 text-pencil">
                      {t("workflow.transitionHelp", "Transitions drive the record review state. Choose the source, destination, and role allowed to perform the action.")}
                    </p>
                    <div className="grid gap-2">
                      <Select
                        value={transitionFrom}
                        onChange={(event) => setTransitionFrom(event.target.value)}
                        className="h-9 text-xs"
                      >
                        {workflow.states.map((state) => (
                          <option key={state.id} value={state.id}>{localizedLabel(state, english)}</option>
                        ))}
                      </Select>
                      <Select
                        value={transitionTo}
                        onChange={(event) => setTransitionTo(event.target.value)}
                        className="h-9 text-xs"
                      >
                        {workflow.states.map((state) => (
                          <option key={state.id} value={state.id}>{localizedLabel(state, english)}</option>
                        ))}
                      </Select>
                      <Select
                        value={transitionRole}
                        onChange={(event) => setTransitionRole(event.target.value)}
                        className="h-9 text-xs"
                      >
                        <option value="field_worker">{t("roles.field_worker")}</option>
                        <option value="supervisor">{t("roles.supervisor")}</option>
                        <option value="org_admin">{t("roles.org_admin")}</option>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={createTransition}
                        disabled={!transitionFrom || !transitionTo || transitionFrom === transitionTo}
                        className="w-full"
                      >
                        <Plus size={14} />
                        {t("workflow.addTransition", "Add transition")}
                      </Button>
                    </div>
                  </div>
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
            <aside className="shrink-0 border-t border-graph-line bg-white lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0">
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

    </div>
  )
}
