import { create } from "zustand"
import { generateId } from "@/lib/utils"
import type { WorkflowDefinition, WorkflowState, WorkflowTransition, FieldDefinition } from "@/types/workflow"

interface WorkflowStateStore {
  workflow: WorkflowDefinition | null
  selectedStateId: string | null
  selectedFieldId: string | null
  setWorkflow: (w: WorkflowDefinition) => void
  updateWorkflow: (partial: Partial<WorkflowDefinition>) => void
  addState: () => void
  updateState: (id: string, partial: Partial<WorkflowState>) => void
  removeState: (id: string) => void
  addTransition: (from: string, to: string) => void
  removeTransition: (id: string) => void
  addField: () => void
  updateField: (id: string, partial: Partial<FieldDefinition>) => void
  removeField: (id: string) => void
  publish: () => void
}

export const useWorkflowStore = create<WorkflowStateStore>()((set, get) => ({
  workflow: null,
  selectedStateId: null,
  selectedFieldId: null,

  setWorkflow: (w) => set({ workflow: w }),

  updateWorkflow: (partial) =>
    set((s) => ({ workflow: s.workflow ? { ...s.workflow, ...partial } : null })),

  addState: () => {
    const w = get().workflow
    if (!w) return
    const s: WorkflowState = {
      id: generateId(),
      key: `state_${w.states.length + 1}`,
      label: `État ${w.states.length + 1}`,
      labelEn: `State ${w.states.length + 1}`,
      color: "#6B7280",
      isInitial: false,
      isTerminal: false,
      x: 100 + (w.states.length % 4) * 180,
      y: 100 + Math.floor(w.states.length / 4) * 120,
    }
    set({ workflow: { ...w, states: [...w.states, s] } })
  },

  updateState: (id, partial) =>
    set((s) => ({
      workflow: s.workflow
        ? { ...s.workflow, states: s.workflow.states.map((st) => (st.id === id ? { ...st, ...partial } : st)) }
        : null,
    })),

  removeState: (id) =>
    set((s) => {
      if (!s.workflow) return s
      return {
        workflow: {
          ...s.workflow,
          states: s.workflow.states.filter((st) => st.id !== id),
          transitions: s.workflow.transitions.filter((t) => t.fromState !== id && t.toState !== id),
        },
        selectedStateId: s.selectedStateId === id ? null : s.selectedStateId,
      }
    }),

  addTransition: (from, to) => {
    const w = get().workflow
    if (!w) return
    const t: WorkflowTransition = {
      id: generateId(),
      key: `transition_${w.transitions.length + 1}`,
      label: `Transition ${w.transitions.length + 1}`,
      labelEn: `Transition ${w.transitions.length + 1}`,
      fromState: from,
      toState: to,
      requiredRoles: [],
    }
    set({ workflow: { ...w, transitions: [...w.transitions, t] } })
  },

  removeTransition: (id) =>
    set((s) => ({
      workflow: s.workflow ? { ...s.workflow, transitions: s.workflow.transitions.filter((t) => t.id !== id) } : null,
    })),

  addField: () => {
    const w = get().workflow
    if (!w) return
    const f: FieldDefinition = {
      id: generateId(),
      key: `field_${w.entity.fields.length + 1}`,
      label: `Champ ${w.entity.fields.length + 1}`,
      labelEn: `Field ${w.entity.fields.length + 1}`,
      type: "text",
      required: false,
      order: w.entity.fields.length,
      section: "default",
    }
    set({
      workflow: {
        ...w,
        entity: { ...w.entity, fields: [...w.entity.fields, f] },
      },
    })
  },

  updateField: (id, partial) =>
    set((s) => ({
      workflow: s.workflow
        ? {
            ...s.workflow,
            entity: {
              ...s.workflow.entity,
              fields: s.workflow.entity.fields.map((f) => (f.id === id ? { ...f, ...partial } : f)),
            },
          }
        : null,
    })),

  removeField: (id) =>
    set((s) => ({
      workflow: s.workflow
        ? {
            ...s.workflow,
            entity: {
              ...s.workflow.entity,
              fields: s.workflow.entity.fields.filter((f) => f.id !== id),
            },
          }
        : null,
      selectedFieldId: s.selectedFieldId === id ? null : s.selectedFieldId,
    })),

  publish: async () => {
    const w = get().workflow
    if (!w) return
    await fetch(`/api/workflows/${w.id}/publish`, { method: "POST", credentials: "include" })
    set({
      workflow: {
        ...w,
        status: "published",
        publishedAt: new Date().toISOString(),
        version: w.version + 1,
      },
    })
  },
}))
