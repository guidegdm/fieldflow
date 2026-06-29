"use client"

import { useEffect } from "react"
import { Workflow } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/stores/authStore"
import { useActiveWorkflowStore } from "@/stores/activeWorkflowStore"
import { useWorkflowListStore } from "@/stores/workflowListStore"
import { workflowLabel } from "@/lib/workflows/runtime"
import { cn } from "@/lib/utils"

export function WorkflowSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const orgId = useAuthStore((state) => state.user?.orgId)
  const workflows = useWorkflowListStore((state) => orgId ? state.byOrgId[orgId] ?? [] : [])
  const loading = useWorkflowListStore((state) => orgId ? state.loadingByOrgId[orgId] : false)
  const loadForOrg = useWorkflowListStore((state) => state.loadForOrg)
  const activeWorkflowId = useActiveWorkflowStore((state) => orgId ? state.byOrgId[orgId]?.workflowId ?? "" : "")
  const setActiveWorkflow = useActiveWorkflowStore((state) => state.setActiveWorkflow)

  useEffect(() => {
    if (orgId && workflows.length === 0 && !loading) void loadForOrg(orgId).catch(() => {})
  }, [loadForOrg, loading, orgId, workflows.length])

  if (!orgId) return null

  const handleChange = (workflowId: string) => {
    const workflow = workflows.find((candidate) => candidate.id === workflowId)
    if (workflow) void setActiveWorkflow(orgId, workflow)
  }

  return (
    <div className={cn("rounded-md border border-graph-line bg-white", compact ? "p-2" : "p-3")}>
      {!compact && (
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-pencil">
          <Workflow size={12} />
          {t("workflow.current", "Workflow")}
        </p>
      )}
      <select
        value={activeWorkflowId}
        onChange={(event) => handleChange(event.target.value)}
        disabled={loading || workflows.length === 0}
        className="h-10 w-full min-w-0 rounded-md border border-graph-line bg-white px-2 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue disabled:text-pencil"
        aria-label={t("workflow.select", "Select workflow")}
      >
        {workflows.length === 0 ? (
          <option value="">{loading ? t("workflow.loading", "Loading workflows") : t("workflow.none", "No published workflows")}</option>
        ) : (
          workflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflowLabel(workflow, i18n.language)}
            </option>
          ))
        )}
      </select>
    </div>
  )
}
