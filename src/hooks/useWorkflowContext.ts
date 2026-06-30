"use client"

import { useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useAuthStore } from "@/stores/authStore"
import { useActiveWorkflowStore } from "@/stores/activeWorkflowStore"
import { useWorkflowListStore } from "@/stores/workflowListStore"
import { onInvalidation } from "@/lib/invalidation"

const EMPTY_WORKFLOWS = [] as const

export function useWorkflowContext() {
  const searchParams = useSearchParams()
  const orgId = useAuthStore((state) => state.user?.orgId)
  const workflows = useWorkflowListStore((state) => orgId ? state.byOrgId[orgId] ?? EMPTY_WORKFLOWS : EMPTY_WORKFLOWS)
  const loading = useWorkflowListStore((state) => orgId ? Boolean(state.loadingByOrgId[orgId]) : false)
  const error = useWorkflowListStore((state) => orgId ? state.errorByOrgId[orgId] ?? null : null)
  const loadForOrg = useWorkflowListStore((state) => state.loadForOrg)
  const activeEntry = useActiveWorkflowStore((state) => orgId ? state.byOrgId[orgId] : undefined)
  const setActiveWorkflow = useActiveWorkflowStore((state) => state.setActiveWorkflow)

  useEffect(() => {
    if (!orgId) return
    void loadForOrg(orgId).catch(() => {})
  }, [loadForOrg, orgId])

  useEffect(() => {
    if (!orgId) return
    return onInvalidation(["workflows", "sync"], () => {
      void loadForOrg(orgId, { force: true }).catch(() => {})
    })
  }, [loadForOrg, orgId])

  useEffect(() => {
    if (!orgId || workflows.length === 0) return
    const requested = searchParams.get("wf")
    const selected = workflows.find((workflow) => workflow.id === requested)
    if (selected && selected.id !== activeEntry?.workflowId) {
      void setActiveWorkflow(orgId, selected)
    }
  }, [activeEntry?.workflowId, orgId, searchParams, setActiveWorkflow, workflows])

  const activeWorkflow = useMemo(() => {
    if (!activeEntry?.workflowId) return workflows[0] ?? null
    return workflows.find((workflow) => workflow.id === activeEntry.workflowId) ?? activeEntry.workflow ?? workflows[0] ?? null
  }, [activeEntry, workflows])

  return {
    orgId,
    workflows,
    activeWorkflow,
    activeWorkflowId: activeWorkflow?.id ?? null,
    loading,
    error,
    setActiveWorkflow,
  }
}
