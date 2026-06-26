'use client'

import { useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRight, Search as SearchIcon } from "lucide-react"
import Link from "next/link"
import type { RecordData } from "@/types/record"

const SAMPLE_RECORDS: RecordData[] = [
  {
    id: "rec-1", workflowId: "wf-1", workflowVersion: 2, entityKey: "household",
    status: "draft", syncStatus: "local", state: "draft",
    fields: { household_name: "Mukwege Family", head_of_household: "Denis Mukwege", household_size: 6, shelter_type: "tente", village: "Bukavu Centre" },
    createdAt: Date.now() - 3600000, updatedAt: Date.now() - 3600000, createdBy: "user-1", deviceId: "device-a", version: 1,
  },
  {
    id: "rec-2", workflowId: "wf-1", workflowVersion: 2, entityKey: "household",
    status: "pending_sync", syncStatus: "pending", state: "submitted",
    fields: { household_name: "Nkunda Family", head_of_household: "Laurent Nkunda", household_size: 4, shelter_type: "abri", village: "Goma" },
    createdAt: Date.now() - 7200000, updatedAt: Date.now() - 7200000, createdBy: "user-1", deviceId: "device-a", version: 1,
  },
  {
    id: "rec-3", workflowId: "wf-1", workflowVersion: 2, entityKey: "household",
    status: "synced", syncStatus: "synced", state: "verified",
    fields: { household_name: "Kabange Family", head_of_household: "Marie Kabange", household_size: 8, shelter_type: "maison", village: "Uvira" },
    createdAt: Date.now() - 86400000, updatedAt: Date.now() - 36000000, createdBy: "user-1", deviceId: "device-a", version: 2, syncedAt: Date.now() - 36000000,
  },
  {
    id: "rec-4", workflowId: "wf-1", workflowVersion: 2, entityKey: "household",
    status: "in_conflict", syncStatus: "conflict", state: "verified",
    fields: { household_name: "Bizimana Family", head_of_household: "Jean Bizimana", household_size: 5, shelter_type: "tente", village: "Minova" },
    createdAt: Date.now() - 172800000, updatedAt: Date.now() - 86400000, createdBy: "user-2", deviceId: "device-b", version: 3,
  },
  { id: "rec-5", workflowId: "wf-1", workflowVersion: 2, entityKey: "household", status: "synced", syncStatus: "synced", state: "verified", fields: { household_name: "Mugisha Family", head_of_household: "Alice Mugisha", household_size: 3, shelter_type: "centre", village: "Kinshasa" }, createdAt: Date.now() - 259200000, updatedAt: Date.now() - 172800000, createdBy: "user-1", deviceId: "device-a", version: 2 },
  { id: "rec-6", workflowId: "wf-1", workflowVersion: 2, entityKey: "household", status: "draft", syncStatus: "local", state: "draft", fields: { household_name: "Habimana Family", head_of_household: "Pierre Habimana", household_size: 7, shelter_type: "maison", village: "Butembo" }, createdAt: Date.now() - 43200000, updatedAt: Date.now() - 43200000, createdBy: "user-1", deviceId: "device-a", version: 1 },
  { id: "rec-7", workflowId: "wf-1", workflowVersion: 2, entityKey: "household", status: "approved", syncStatus: "synced", state: "approved", fields: { household_name: "Uwimana Family", head_of_household: "Grace Uwimana", household_size: 5, shelter_type: "tente", village: "Goma" }, createdAt: Date.now() - 604800000, updatedAt: Date.now() - 432000000, createdBy: "user-2", deviceId: "device-b", version: 4 },
]

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
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all")

  const filtered = useMemo(() => {
    let results = SAMPLE_RECORDS

    if (activeFilter === "pending") {
      results = results.filter((r) => r.syncStatus === "pending" || r.syncStatus === "local")
    } else if (activeFilter === "verified") {
      results = results.filter((r) => r.status === "synced" || r.status === "approved")
    } else if (activeFilter === "synced") {
      results = results.filter((r) => r.syncStatus === "synced")
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      results = results.filter((r) => {
        const name = (r.fields.household_name as string)?.toLowerCase() || ""
        const village = (r.fields.village as string)?.toLowerCase() || ""
        const head = (r.fields.head_of_household as string)?.toLowerCase() || ""
        return name.includes(q) || village.includes(q) || head.includes(q) || r.id.includes(q)
      })
    }

    return results
  }, [query, activeFilter])

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
                : "bg-white border border-grid-line text-pencil hover:bg-gray-50"
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
              className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-graph-line bg-white min-h-[44px] hover:bg-gray-50 transition-colors"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[r.status] || "bg-pencil"}`} />
              <span className="flex-1 min-w-0">
                <span className="text-sm font-medium text-ink-black truncate block">{r.fields.household_name as string}</span>
                <span className="text-xs text-pencil">{r.fields.household_size as string} pers. · {r.fields.shelter_type as string}</span>
              </span>
              <ChevronRight size={16} className="text-pencil shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
