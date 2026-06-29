"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Workflow } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWorkflowContext } from "@/hooks/useWorkflowContext"
import { workflowLabel } from "@/lib/workflows/runtime"

export default function PickWorkflowPage() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { orgId, workflows, loading, error, setActiveWorkflow } = useWorkflowContext()
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return workflows
    return workflows.filter((workflow) =>
      `${workflow.name} ${workflow.nameEn} ${workflow.description} ${workflow.descriptionEn}`.toLowerCase().includes(q),
    )
  }, [query, workflows])

  const choose = async (workflowId: string) => {
    const workflow = workflows.find((candidate) => candidate.id === workflowId)
    if (!orgId || !workflow) return
    await setActiveWorkflow(orgId, workflow)
    router.push(`/field-worker/home?wf=${encodeURIComponent(workflow.id)}`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-4 pb-28">
      <div>
        <p className="mb-2 inline-flex items-center gap-2 rounded-md border border-graph-line bg-white px-3 py-1 text-xs font-medium text-pencil">
          <Workflow size={14} />
          {t("workflow.chooseLabel", "Workflow")}
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-black">
          {t("workflow.chooseTitle", "What are you working on today?")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-pencil">
          {t("workflow.chooseBody", "Choose the published workflow this device should use for new records. It stays available offline after loading.")}
        </p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pencil" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("workflow.search", "Search workflows")}
          className="h-11 w-full rounded-md border border-graph-line bg-white pl-9 pr-3 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue"
        />
      </div>

      {loading && workflows.length === 0 ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-md border border-graph-line bg-white" />)}
        </div>
      ) : error && workflows.length === 0 ? (
        <div className="rounded-md border border-warning-500/30 bg-warning-500/10 p-4 text-sm text-ink-black">
          {t("workflow.loadFailed", "Workflows could not be loaded. Reconnect and try again.")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-graph-line bg-white p-8 text-center text-sm text-pencil">
          {t("workflow.none", "No published workflows")}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((workflow) => (
            <button
              key={workflow.id}
              type="button"
              onClick={() => choose(workflow.id)}
              className="rounded-md border border-graph-line bg-white p-4 text-left shadow-sm transition-colors hover:border-ink-blue/40 hover:bg-graph-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue"
            >
              <span className="block font-display text-xl font-semibold text-ink-black">
                {workflowLabel(workflow, i18n.language)}
              </span>
              <span className="mt-1 line-clamp-2 block text-sm leading-6 text-pencil">
                {i18n.language?.startsWith("en") ? workflow.descriptionEn || workflow.description : workflow.description || workflow.descriptionEn}
              </span>
              <span className="mt-3 inline-flex rounded-md bg-kivu-paper px-2 py-1 text-xs font-medium text-pencil">
                {workflow.entity.fields.length} {t("workflow.fields", "fields")} · v{workflow.version}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
