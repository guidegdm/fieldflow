"use client"

import { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useParams, useRouter } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useWorkflowStore } from "@/stores/workflowStore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ArrowRight, Plus, Trash2 } from "lucide-react"
import { AIPanel } from "@/components/ai/AIPanel"
import type { WorkflowDefinition, WorkflowTransition } from "@/types/workflow"

const DEMO_WORKFLOW: WorkflowDefinition = {
  id: "wf-1", version: 2,
  name: "Enregistrement et Distribution Humanitaire",
  nameEn: "Humanitarian Registration & Distribution",
  description: "Enregistrement des menages, evaluation des besoins et distribution d'aide",
  descriptionEn: "Household registration, needs assessment, and aid distribution",
  entity: {
    id: "entity-household", key: "household", label: "Menage", labelEn: "Household",
    fields: [
      { id: "f-1", key: "household_name", label: "Nom du menage", labelEn: "Household name", type: "text", required: true, order: 1, section: "Identification" },
      { id: "f-2", key: "head_of_household", label: "Chef de menage", labelEn: "Head of household", type: "text", required: true, order: 2, section: "Identification" },
      { id: "f-3", key: "household_size", label: "Taille du menage", labelEn: "Household size", type: "number", required: true, validation: { min: 1, max: 20 }, order: 3, section: "Identification" },
      { id: "f-4", key: "shelter_type", label: "Type d'abri", labelEn: "Shelter type", type: "select", required: true, options: [{ label: "Tente", value: "tent" }, { label: "Abri provisoire", value: "temporary" }, { label: "Hebergement", value: "hosted" }], order: 4, section: "Identification" },
      { id: "f-5", key: "village", label: "Village", labelEn: "Village", type: "text", required: true, order: 5, section: "Identification" },
      { id: "f-6", key: "gps", label: "Coordonnees GPS", labelEn: "GPS Coordinates", type: "gps", required: false, order: 6, section: "Conditions de vie" },
      { id: "f-7", key: "vulnerability_score", label: "Score de vulnerabilite", labelEn: "Vulnerability score", type: "number", required: true, validation: { min: 1, max: 5 }, order: 7, section: "Conditions de vie" },
      { id: "f-8", key: "needs", label: "Besoins prioritaires", labelEn: "Priority needs", type: "multi_select", required: true, options: [{ label: "Nourriture", value: "food" }, { label: "Eau potable", value: "water" }, { label: "Materiel d'abri", value: "shelter" }, { label: "Medicaments", value: "medicine" }], order: 8, section: "Besoins" },
    ],
  },
  states: [
    { id: "s-draft", key: "draft", label: "Brouillon", labelEn: "Draft", color: "#6B7280", isInitial: true, isTerminal: false, x: 200, y: 50 },
    { id: "s-submitted", key: "submitted", label: "Soumis", labelEn: "Submitted", color: "#2563EB", isInitial: false, isTerminal: false, x: 200, y: 150 },
    { id: "s-verified", key: "verified", label: "Verifie", labelEn: "Verified", color: "#9333EA", isInitial: false, isTerminal: false, x: 200, y: 250 },
    { id: "s-approved", key: "approved", label: "Approuve", labelEn: "Approved", color: "#16A34A", isInitial: false, isTerminal: false, x: 200, y: 350 },
    { id: "s-reserved", key: "reserved", label: "Reserve", labelEn: "Reserved", color: "#D97706", isInitial: false, isTerminal: false, x: 200, y: 450 },
    { id: "s-distributed", key: "distributed", label: "Distribue", labelEn: "Distributed", color: "#059669", isInitial: false, isTerminal: false, x: 200, y: 550 },
    { id: "s-confirmed", key: "confirmed", label: "Confirme", labelEn: "Confirmed", color: "#1D4ED8", isInitial: false, isTerminal: true, x: 200, y: 650 },
  ],
  transitions: [
    { id: "t-1", key: "submit", label: "Soumettre", labelEn: "Submit", fromState: "s-draft", toState: "s-submitted", requiredRoles: ["field_worker"] },
    { id: "t-2", key: "verify", label: "Verifier", labelEn: "Verify", fromState: "s-submitted", toState: "s-verified", requiredRoles: ["supervisor"] },
    { id: "t-3", key: "approve", label: "Approuver", labelEn: "Approve", fromState: "s-verified", toState: "s-approved", requiredRoles: ["supervisor"] },
    { id: "t-4", key: "reserve", label: "Reserver", labelEn: "Reserve", fromState: "s-approved", toState: "s-reserved", requiredRoles: ["supervisor"], sideEffects: ["inventory_reserve"] },
    { id: "t-5", key: "distribute", label: "Distribuer", labelEn: "Distribute", fromState: "s-reserved", toState: "s-distributed", requiredRoles: ["field_worker"] },
    { id: "t-6", key: "confirm", label: "Confirmer", labelEn: "Confirm", fromState: "s-distributed", toState: "s-confirmed", requiredRoles: ["field_worker"] },
  ],
  roles: [
    { id: "r-1", key: "field_worker", label: "Agent terrain", permissions: ["record:create", "record:read_own", "record:update_own", "sync:push", "sync:pull"] },
    { id: "r-2", key: "supervisor", label: "Superviseur", permissions: ["record:create", "record:read_team", "record:verify", "record:approve", "sync:push", "sync:pull", "audit:view"] },
    { id: "r-3", key: "org_admin", label: "Administrateur", permissions: ["record:create", "record:read_team", "record:verify", "record:approve", "sync:push", "sync:pull", "audit:view", "workflow:publish", "admin:manage_users"] },
  ],
  offlinePolicy: {
    maxOfflineHours: 72,
    allowedOperations: { create: true, update: true, delete: false, evidence: true },
    conflictStrategy: "manual",
    manualResolutionFields: ["household_size", "gps", "vulnerability_score"],
    autoResolutionNumeric: "average",
    maxAttachmentSizeMb: 5,
    allowedAttachmentTypes: ["image/jpeg", "image/png"],
    attachmentSyncPriority: "normal",
  },
  status: "published", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), publishedAt: new Date().toISOString(), author: "celine",
}

const STATE_COLORS: Record<string, string> = {
  draft: "#6B7280",
  submitted: "#2563EB",
  verified: "#9333EA",
  approved: "#16A34A",
  reserved: "#D97706",
  distributed: "#059669",
  confirmed: "#1D4ED8",
}

export default function WorkflowBuilder() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const {
    workflow, setWorkflow, updateWorkflow,
    selectedStateId,
    addState, removeState,
    addTransition, removeTransition,
    publish,
  } = useWorkflowStore()

  const selectState = (id: string | null) => useWorkflowStore.setState({ selectedStateId: id })

  useEffect(() => {
    if (params.id) setWorkflow(DEMO_WORKFLOW)
  }, [params.id, setWorkflow])

  useEffect(() => {
    if (!user || user.role !== "org_admin") router.push("/")
  }, [user, router])

  const selectedState = useMemo(
    () => workflow?.states.find((s) => s.id === selectedStateId) ?? null,
    [workflow?.states, selectedStateId],
  )

  const stateColor = (key: string) => STATE_COLORS[key] ?? "#6B7280"

  const visibleTransitions = useMemo(() => {
    if (!workflow) return []
    return workflow.transitions
  }, [workflow])

  const svgArrows = useMemo(() => {
    if (!workflow) return []
    return workflow.transitions
      .map((tr) => {
        const from = workflow.states.find((s) => s.id === tr.fromState)
        const to = workflow.states.find((s) => s.id === tr.toState)
        if (!from || !to) return null
        return { transition: tr, from, to }
      })
      .filter(Boolean) as { transition: WorkflowTransition; from: typeof workflow.states[0]; to: typeof workflow.states[0] }[]
  }, [workflow])

  if (!user || user.role !== "org_admin") return null
  if (!workflow) return null

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-8">
      <div className="flex items-center justify-between px-6 py-3 border-b-2 border-volcanic-ash/30 bg-white">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/admin/workflows")} className="text-sm text-volcanic-ash hover:text-lake-deep transition-colors">
            ← {t("workflow.builder")}
          </button>
          <span className="text-volcanic-ash/30">|</span>
          <input
            value={workflow.name}
            onChange={(e) => updateWorkflow({ name: e.target.value })}
            className="font-display text-xl text-lake-deep tracking-tight bg-transparent border-none outline-none focus:ring-0 p-0"
          />
          <Badge variant={workflow.status === "published" ? "success" : "default"} size="sm">
            {workflow.status === "published" ? t("workflow.published") : t("workflow.draft")}
          </Badge>
          <span className="font-mono text-xs text-volcanic-ash">v{workflow.version}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm">{t("common.save")}</Button>
          <Button variant="primary" size="sm" onClick={publish}>
            {t("workflow.publish")}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[20%] border-r-2 border-volcanic-ash/30 bg-white overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-[11px] uppercase tracking-[0.15em] text-soil font-semibold mb-3">{t("admin.entity")}</h3>
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink-black">{workflow.entity.label}</p>
              <p className="font-mono text-xs text-volcanic-ash">{t("workflow.fieldsCount", { count: workflow.entity.fields.length })}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] uppercase tracking-[0.15em] text-soil font-semibold">{t("workflow.states")}</h3>
              <button onClick={addState} className="text-volcanic-ash hover:text-lake-deep transition-colors">
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-1">
              {workflow.states.map((state) => (
                <div
                  key={state.id}
                  onClick={() => selectState(state.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                    selectedStateId === state.id
                      ? "bg-clay/10 border border-clay/30"
                      : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stateColor(state.key) }} />
                    <span className="text-ink-black">{state.label}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeState(state.id) }}
                    className="text-volcanic-ash/50 hover:text-rebar transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[11px] uppercase tracking-[0.15em] text-soil font-semibold mb-3">{t("workflow.transitions")}</h3>
            <div className="space-y-1">
              {workflow.transitions.map((tr) => {
                const from = workflow.states.find((s) => s.id === tr.fromState)
                const to = workflow.states.find((s) => s.id === tr.toState)
                return (
                  <div key={tr.id} className="flex items-center gap-2 px-3 py-2 text-xs text-volcanic-ash">
                    <span className="text-ink-black">{from?.label ?? "?"}</span>
                    <ArrowRight size={12} className="text-clay" />
                    <span className="text-ink-black">{to?.label ?? "?"}</span>
                    <button
                      onClick={() => removeTransition(tr.id)}
                      className="ml-auto text-volcanic-ash/50 hover:text-rebar transition-colors"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="w-[55%] relative bg-kivu-paper overflow-hidden">
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {svgArrows.map(({ transition, from, to }) => (
              <line
                key={transition.id}
                x1={from.x + 80}
                y1={from.y + 28}
                x2={to.x + 80}
                y2={to.y + 28}
                stroke="#708090"
                strokeWidth="2"
                strokeDasharray={transition.requiredRoles.length ? "0" : "6,3"}
                markerEnd="url(#arrowhead)"
              />
            ))}
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#708090" />
              </marker>
            </defs>
          </svg>

          {workflow.states.map((state) => (
            <div
              key={state.id}
              onClick={() => selectState(state.id)}
              className={`absolute flex items-center justify-center w-40 h-14 rounded-md border-2 cursor-pointer transition-shadow text-sm font-medium ${
                selectedStateId === state.id ? "shadow-lg ring-2 ring-clay" : "shadow-sm"
              }`}
              style={{
                left: state.x,
                top: state.y,
                backgroundColor: stateColor(state.key) + "15",
                borderColor: stateColor(state.key),
                color: stateColor(state.key),
              }}
            >
              {state.label}
            </div>
          ))}
        </div>

        <div className="w-[25%] border-l-2 border-volcanic-ash/30 bg-white overflow-y-auto">
          <Tabs defaultValue="properties">
            <TabsList className="w-full px-4">
              <TabsTrigger value="properties" className="text-[11px] uppercase tracking-[0.1em]">{t("admin.properties")}</TabsTrigger>
              <TabsTrigger value="fields" className="text-[11px] uppercase tracking-[0.1em]">{t("workflow.fields")}</TabsTrigger>
              <TabsTrigger value="roles" className="text-[11px] uppercase tracking-[0.1em]">{t("workflow.roles")}</TabsTrigger>
              <TabsTrigger value="publication" className="text-[11px] uppercase tracking-[0.1em]">{t("admin.publication")}</TabsTrigger>
              <TabsTrigger value="ai" className="text-[11px] uppercase tracking-[0.1em]">{t("admin.ai")}</TabsTrigger>
            </TabsList>

            <TabsContent value="properties" className="px-4 py-4 space-y-4">
              {selectedState ? (
                <>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.stateLabel")}</label>
                    <p className="text-sm font-medium text-ink-black mt-1">{selectedState.label}</p>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.key")}</label>
                    <p className="font-mono text-sm text-volcanic-ash mt-1">{selectedState.key}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded" style={{ backgroundColor: stateColor(selectedState.key) }} />
                    <span className="text-sm text-ink-black">{stateColor(selectedState.key)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={selectedState.isInitial ? "info" : "default"} size="sm">
                      {selectedState.isInitial ? t("admin.stateInitial") : t("admin.stateStandard")}
                    </Badge>
                    <Badge variant={selectedState.isTerminal ? "success" : "default"} size="sm">
                      {selectedState.isTerminal ? t("admin.stateTerminal") : ""}
                    </Badge>
                  </div>
                </>
              ) : (
                <p className="text-sm text-volcanic-ash italic">{t("admin.noSelection")}</p>
              )}
            </TabsContent>

            <TabsContent value="fields" className="px-4 py-4 space-y-3">
              {workflow.entity.fields.map((field) => (
                <div key={field.id} className="p-3 rounded-md border border-volcanic-ash/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink-black">{field.label}</span>
                    <Badge variant={field.required ? "warning" : "default"} size="sm">
                      {field.required ? t("common.required") : t("common.optional")}
                    </Badge>
                  </div>
                  <span className="font-mono text-xs text-volcanic-ash">{field.type}</span>
                </div>
              ))}
              <button
                onClick={() => useWorkflowStore.getState().addField()}
                className="w-full py-2 text-sm text-clay hover:text-clay/80 transition-colors flex items-center justify-center gap-1"
              >
                <Plus size={14} /> {t("workflow.fields")}
              </button>
            </TabsContent>

            <TabsContent value="roles" className="px-4 py-4 space-y-3">
              {workflow.roles.map((role) => (
                <div key={role.id} className="p-3 rounded-md border border-volcanic-ash/20">
                  <p className="text-sm font-medium text-ink-black">{role.label}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {role.permissions.map((perm) => (
                      <span key={perm} className="text-[10px] uppercase tracking-[0.05em] bg-kivu-paper text-volcanic-ash px-1.5 py-0.5 rounded">
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="ai" className="h-full">
              <AIPanel />
            </TabsContent>

            <TabsContent value="publication" className="px-4 py-4 space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.version")}</label>
                <p className="font-display text-2xl text-lake-deep mt-1">v{workflow.version}</p>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("records.status")}</label>
                <p className="text-sm text-ink-black mt-1 capitalize">{workflow.status}</p>
              </div>
              {workflow.publishedAt && (
                <div>
                  <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.publishedOn")}</label>
                  <p className="text-sm text-ink-black mt-1">
                    {new Date(workflow.publishedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
              )}
              <Button variant="primary" className="w-full" onClick={publish}>
                {t("workflow.publish")}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
