import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { WorkflowDefinition } from "@/types/workflow"

type ActiveWorkflowEntry = {
  workflowId: string
  workflow?: WorkflowDefinition
}

interface ActiveWorkflowState {
  byOrgId: Record<string, ActiveWorkflowEntry>
  hasHydrated: boolean
  getActiveWorkflowId: (orgId?: string | null) => string | null
  getActiveWorkflow: (orgId?: string | null) => WorkflowDefinition | null
  setActiveWorkflow: (orgId: string, workflow: WorkflowDefinition) => Promise<void>
  clearOrgWorkflow: (orgId: string) => void
}

export const useActiveWorkflowStore = create<ActiveWorkflowState>()(
  persist(
    (set, get) => ({
      byOrgId: {},
      hasHydrated: false,
      getActiveWorkflowId: (orgId) => (orgId ? get().byOrgId[orgId]?.workflowId ?? null : null),
      getActiveWorkflow: (orgId) => (orgId ? get().byOrgId[orgId]?.workflow ?? null : null),
      setActiveWorkflow: async (orgId, workflow) => {
        set((state) => ({
          byOrgId: {
            ...state.byOrgId,
            [orgId]: { workflowId: workflow.id, workflow },
          },
        }))
        try {
          const { db } = await import("@/lib/db/indexeddb")
          await db.saveWorkflow(workflow)
          await db.updateDeviceState({
            workflow_id: workflow.id,
            workflow_version: workflow.version,
          })
        } catch {
          // Workflow context should still work from localStorage if IndexedDB is unavailable.
        }
      },
      clearOrgWorkflow: (orgId) => set((state) => {
        const next = { ...state.byOrgId }
        delete next[orgId]
        return { byOrgId: next }
      }),
    }),
    {
      name: "fieldflow-active-workflow",
      partialize: (state) => ({ byOrgId: state.byOrgId }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true
      },
    },
  ),
)
