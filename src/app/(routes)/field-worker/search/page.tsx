'use client'

import { useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRight, Search as SearchIcon } from "lucide-react"
import Link from "next/link"
import type { RecordData } from "@/types/record"
import { useAuthStore } from "@/stores/authStore"
import { useWorkflowContext } from "@/hooks/useWorkflowContext"
import { recordSubtitle, recordTitle } from "@/lib/workflows/runtime"

type FilterKey = "all" | "pending" | "verified" | "synced"

const FILTERS: { key: FilterKey; labelKey: string }[] = [
  { key: "all", labelKey: "search.all" },
  { key: "pending", labelKey: "search.pending" },
  { key: "verified", labelKey: "search.verified" },
  { key: "synced", labelKey: "search.synced" },
]

const statusDot: Record<string, string> = {
  draft: "bg-pencil",
  pending_sync: "bg-warning-500",
  synced: "bg-success-500",
  approved: "bg-success-500",
  rejected: "bg-danger-500",
  in_conflict: "bg-warning-500",
  conflict_resolved: "bg-success-500",
  distributed: "bg-success-500",
  blocked: "bg-danger-500",
}

export default function SearchPage() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { activeWorkflow, activeWorkflowId } = useWorkflowContext()
  const [query, setQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")
  const [records, setRecords] = useState<RecordData[]>([])

  useEffect(() => {
    async function load() {
      if (!activeWorkflowId) return
      try {
        const { db } = await import("@/lib/db/indexeddb")
        const local = (user?.orgId ? await db.getAllRecordsForOrg(user.orgId) : await db.getAllRecords())
          .filter((record) => record.workflowId === activeWorkflowId)
        if (local.length > 0) setRecords(local)
      } catch { /* IndexedDB can be unavailable */ }

      try {
        const res = await fetch(`/api/workflows/${activeWorkflowId}/records`, { credentials: "include" })
        const server = res.ok ? await res.json() : []
        if (Array.isArray(server)) {
          const scoped = server.filter((record: RecordData) => record.workflowId === activeWorkflowId)
          setRecords(scoped)
          if (user?.orgId) {
            const { db } = await import("@/lib/db/indexeddb")
            await Promise.all(scoped.map((record: RecordData) => db.putRecord(record)))
          }
        }
      } catch { /* keep local records */ }
    }
    load()
  }, [activeWorkflowId, user?.orgId])

  const filtered = useMemo(() => {
    let results = records

    if (activeFilter === "pending") {
      results = results.filter((r) => r.syncStatus === "pending" || r.syncStatus === "local")
    } else if (activeFilter === "verified") {
      results = results.filter((r) => r.status === "synced" || r.status === "approved")
    } else if (activeFilter === "synced") {
      results = results.filter((r) => r.syncStatus === "synced")
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      results = results.filter((r) =>
        Object.values(r.fields ?? {}).some((value) => String(value ?? "").toLowerCase().includes(q)) || r.id.includes(q),
      )
    }

    return results
  }, [query, activeFilter, records])

  return (
    <div className="py-4 space-y-4">
      <h1 className="font-display text-2xl font-bold text-ink-black tracking-tight">{t("common.search")}</h1>

      <div className="relative">
        <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pencil" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          className="w-full h-10 pl-9 pr-3 rounded-md border border-grid-line bg-white text-sm text-ink-black placeholder:text-pencil/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px] ${
              activeFilter === f.key
                ? "bg-ink-blue text-white"
                : "bg-white border border-grid-line text-pencil hover:bg-graph-paper"
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-pencil">{t("search.noResults")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/field-worker/record/${r.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-graph-line bg-white min-h-[44px] hover:bg-graph-paper transition-colors"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[r.status] || "bg-pencil"}`} />
              <span className="flex-1 min-w-0">
                <span className="text-sm font-medium text-ink-black truncate block">{recordTitle(r, activeWorkflow)}</span>
                <span className="text-xs text-pencil">{recordSubtitle(r, activeWorkflow, i18n.language)}</span>
              </span>
              <ChevronRight size={16} className="text-pencil shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
