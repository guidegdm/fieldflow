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
import type { WorkflowDefinition, WorkflowTransition } from "@/types/workflow"

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
  status: "published",
  createdAt: "2025-11-01T08:00:00Z",
  updatedAt: "2026-06-25T14:30:00Z",
  publishedAt: "2026-06-20T10:00:00Z",
  author: "Céline M.",
}

const STATE_COLORS: Record<string, string> = {
  brouillon: "#6B7280",
  soumis: "#D97706",
  verifie: "#2563EB",
  approuve: "#16A34A",
  reserve: "#C17A4E",
  distribue: "#059669",
  confirme: "#1B4F72",
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
              <p className="font-mono text-xs text-volcanic-ash">{workflow.entity.fields.length} champs</p>
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
            {svgArrows.map(({ transition, from, to }) => {
              // Node box is 160x56; clip the connector to each node's edge so
              // arrows stop at the border instead of crossing through labels.
              const hw = 80
              const hh = 28
              const fcx = from.x + hw
              const fcy = from.y + hh
              const tcx = to.x + hw
              const tcy = to.y + hh
              const dx = tcx - fcx
              const dy = tcy - fcy
              const edge = (cx: number, cy: number, sx: number, sy: number) => {
                if (sx === 0 && sy === 0) return { x: cx, y: cy }
                const scale = 1 / Math.max(Math.abs(sx) / hw, Math.abs(sy) / hh)
                return { x: cx + sx * scale, y: cy + sy * scale }
              }
              const start = edge(fcx, fcy, dx, dy)
              const end = edge(tcx, tcy, -dx, -dy)
              return (
                <line
                  key={transition.id}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#708090"
                  strokeWidth="2"
                  strokeDasharray={transition.requiredRoles.length ? "0" : "6,3"}
                  markerEnd="url(#arrowhead)"
                />
              )
            })}
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
            </TabsList>

            <TabsContent value="properties" className="px-4 py-4 space-y-4">
              {selectedState ? (
                <>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.stateLabel")}</label>
                    <p className="text-sm font-medium text-ink-black mt-1">{selectedState.label}</p>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">Clé</label>
                    <p className="font-mono text-sm text-volcanic-ash mt-1">{selectedState.key}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded" style={{ backgroundColor: stateColor(selectedState.key) }} />
                    <span className="text-sm text-ink-black">{stateColor(selectedState.key)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={selectedState.isInitial ? "info" : "default"} size="sm">
                      {selectedState.isInitial ? "Initial" : "Standard"}
                    </Badge>
                    <Badge variant={selectedState.isTerminal ? "success" : "default"} size="sm">
                      {selectedState.isTerminal ? "Terminal" : ""}
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
                      {field.required ? t("common.required") : "optionnel"}
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

            <TabsContent value="publication" className="px-4 py-4 space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">{t("admin.version")}</label>
                <p className="font-display text-2xl text-lake-deep mt-1">v{workflow.version}</p>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">Statut</label>
                <p className="text-sm text-ink-black mt-1 capitalize">{workflow.status}</p>
              </div>
              {workflow.publishedAt && (
                <div>
                  <label className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">Publié le</label>
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
