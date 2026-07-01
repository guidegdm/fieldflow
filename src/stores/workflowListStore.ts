import { create } from "zustand"
import type { WorkflowDefinition } from "@/types/workflow"
import { useActiveWorkflowStore } from "@/stores/activeWorkflowStore"

interface WorkflowListState {
  byOrgId: Record<string, WorkflowDefinition[]>
  loadingByOrgId: Record<string, boolean>
  errorByOrgId: Record<string, string | null>
  fetchedAtByOrgId: Record<string, number>
  loadForOrg: (orgId: string, options?: { force?: boolean }) => Promise<WorkflowDefinition[]>
}

const WORKFLOW_LIST_TTL_MS = 45_000

function published(workflows: WorkflowDefinition[]) {
  return workflows
    .filter((workflow) => workflow.status === "published")
    .sort((a, b) => {
      const aTime = Date.parse(a.publishedAt || a.updatedAt || a.createdAt || "")
      const bTime = Date.parse(b.publishedAt || b.updatedAt || b.createdAt || "")
      return bTime - aTime
    })
}

export const useWorkflowListStore = create<WorkflowListState>((set, get) => ({
  byOrgId: {},
  loadingByOrgId: {},
  errorByOrgId: {},
  fetchedAtByOrgId: {},
  loadForOrg: async (orgId, options) => {
    const cached = get().byOrgId[orgId]
    const fetchedAt = get().fetchedAtByOrgId[orgId] ?? 0
    if (cached && !options?.force && Date.now() - fetchedAt < WORKFLOW_LIST_TTL_MS) return cached
    if (cached?.length && !options?.force) return cached

    set((state) => ({
      loadingByOrgId: { ...state.loadingByOrgId, [orgId]: true },
      errorByOrgId: { ...state.errorByOrgId, [orgId]: null },
    }))

    let local: WorkflowDefinition[] = []
    try {
      const { db } = await import("@/lib/db/indexeddb")
      local = published(await db.getAllWorkflowsForOrg(orgId))
      if (local.length) {
        set((state) => ({ byOrgId: { ...state.byOrgId, [orgId]: local } }))
      }
    } catch {
      // Keep going; the network fetch below may still work.
    }

    try {
      const response = await fetch("/api/workflows", { credentials: "include", cache: "no-store" })
      if (!response.ok) throw new Error("workflow_fetch_failed")
      const server = published(await response.json())
      set((state) => ({
        byOrgId: { ...state.byOrgId, [orgId]: server },
        loadingByOrgId: { ...state.loadingByOrgId, [orgId]: false },
        fetchedAtByOrgId: { ...state.fetchedAtByOrgId, [orgId]: Date.now() },
      }))
      try {
        const { db } = await import("@/lib/db/indexeddb")
        await db.replaceWorkflowsForOrg(orgId, server)
      } catch {}
      const activeStore = useActiveWorkflowStore.getState()
      const current = activeStore.getActiveWorkflowId(orgId)
      const selected = server.find((workflow) => workflow.id === current) ?? server[0]
      if (selected && (!current || !server.some((workflow) => workflow.id === current))) {
        await activeStore.setActiveWorkflow(orgId, selected)
      }
      return server
    } catch (error) {
      const message = error instanceof Error ? error.message : "workflow_fetch_failed"
      set((state) => ({
        loadingByOrgId: { ...state.loadingByOrgId, [orgId]: false },
        errorByOrgId: { ...state.errorByOrgId, [orgId]: message },
        fetchedAtByOrgId: { ...state.fetchedAtByOrgId, [orgId]: Date.now() },
      }))
      const activeStore = useActiveWorkflowStore.getState()
      const current = activeStore.getActiveWorkflowId(orgId)
      const selected = local.find((workflow) => workflow.id === current) ?? local[0]
      if (selected && (!current || !local.some((workflow) => workflow.id === current))) {
        await activeStore.setActiveWorkflow(orgId, selected)
      }
      return local
    }
  },
}))
