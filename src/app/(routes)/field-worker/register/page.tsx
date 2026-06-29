"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ArrowLeft, CheckCircle, ClipboardList, MapPin, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldRenderer } from "@/components/fields/FieldRenderer"
import { useWorkflowContext } from "@/hooks/useWorkflowContext"
import { generateId } from "@/lib/utils"
import { db } from "@/lib/db/indexeddb"
import { runBackgroundSync } from "@/lib/sync/run-background-sync"
import { groupFieldsBySection, initialStateId, sectionLabel, workflowLabel } from "@/lib/workflows/runtime"
import { useAuthStore } from "@/stores/authStore"
import { useSyncStore } from "@/stores/syncStore"
import type { MutationEntry } from "@/types/sync"
import type { RecordData } from "@/types/record"

type FormValues = Record<string, unknown>

function defaultValueForType(type: string) {
  if (type === "multi-select") return []
  if (type === "number") return 0
  return ""
}

export default function RegisterPage() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const { activeWorkflow, activeWorkflowId, loading, workflows } = useWorkflowContext()
  const [values, setValues] = useState<FormValues>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [recordId, setRecordId] = useState(() => generateId())
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState("")

  const fields = useMemo(() => activeWorkflow?.entity.fields ?? [], [activeWorkflow])
  const sections = useMemo(() => groupFieldsBySection(fields), [fields])

  useEffect(() => {
    if (!activeWorkflow) return
    setValues(Object.fromEntries(fields.map((field) => [
      field.key,
      field.type === "number" && field.validation?.min !== undefined ? field.validation.min : defaultValueForType(field.type),
    ])))
    setErrors({})
  }, [activeWorkflow, fields])

  const setFieldValue = (key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const validate = () => {
    const next: Record<string, string> = {}
    for (const field of fields) {
      if (!field.required || field.type === "gps" || field.type === "photo") continue
      const value = values[field.key]
      const missing = Array.isArray(value) ? value.length === 0 : value === undefined || value === null || value === ""
      if (missing) next[field.key] = t("common.required")
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user?.orgId || !activeWorkflow || !activeWorkflowId) {
      setSaveError(t("workflow.selectRequired", "Select a workflow before creating records."))
      return
    }
    if (!validate()) return

    setSaving(true)
    const id = recordId
    const now = Date.now()
    const deviceId = user.deviceId || "web"
    const state = initialStateId(activeWorkflow)
    const record: RecordData = {
      id,
      workflowId: activeWorkflow.id,
      workflowVersion: activeWorkflow.version,
      entityKey: activeWorkflow.entity.key,
      status: "pending_sync",
      syncStatus: "local",
      state,
      fields: { ...values },
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
      deviceId,
      version: 1,
      orgId: user.orgId,
    }

    const mutation: MutationEntry = {
      client_id: id,
      device_id: deviceId,
      operation: "create",
      resource: "record",
      workflow_id: activeWorkflow.id,
      record_id: id,
      payload: record,
      client_timestamp: now,
      base_version: 0,
      base_fields: {},
      status: "PENDING",
      retry_count: 0,
      last_error: null,
      enqueued_at: now,
    }

    try {
      setSaveError("")
      await db.putRecord(record)
      await db.enqueueMutation(mutation)
      useSyncStore.getState().setPendingCount((await db.getPendingMutations()).length)
      void runBackgroundSync(user)
      setSaved(true)
      setRecordId(generateId())
    } catch {
      setSaveError(t("register.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-500/10">
          <CheckCircle size={32} className="text-success-500" />
        </div>
        <h2 className="mb-1 font-display text-xl font-bold text-ink-black">{t("register.savedLocally")}</h2>
        <p className="mb-6 max-w-xs text-sm text-pencil">{t("register.successMessage")}</p>
        <Button variant="primary" size="lg" className="w-full max-w-xs" onClick={() => router.push("/field-worker/home")}>
          {t("common.back")}
        </Button>
      </div>
    )
  }

  if (loading && !activeWorkflow) {
    return <div className="h-64 animate-pulse rounded-md border border-graph-line bg-white" />
  }

  if (!activeWorkflow || workflows.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-black">{t("workflow.none", "No published workflows")}</h1>
        <p className="mt-2 text-sm leading-6 text-pencil">{t("workflow.noneBody", "Ask an administrator to publish a workflow before creating records.")}</p>
        <Button className="mt-5" variant="primary" onClick={() => router.push("/field-worker/pick-workflow")}>
          {t("workflow.chooseAction", "Choose workflow")}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl pb-28 lg:pb-8">
      <div className="mb-5 flex flex-col gap-4 rounded-lg border border-graph-line bg-white px-4 py-4 shadow-sm sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <button onClick={() => router.back()} className="mb-3 inline-flex min-h-9 items-center gap-2 rounded-md px-1 text-sm text-pencil transition-colors hover:text-ink-black">
            <ArrowLeft size={17} />
            {t("common.back")}
          </button>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink-blue/10 text-ink-blue">
              <ClipboardList size={20} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-black sm:text-3xl">
                {workflowLabel(activeWorkflow, i18n.language)}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-pencil">
                {i18n.language?.startsWith("en") ? activeWorkflow.descriptionEn || activeWorkflow.description : activeWorkflow.description || activeWorkflow.descriptionEn}
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-pencil sm:flex sm:items-center">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-graph-line bg-kivu-paper px-3 py-2">
            <ShieldCheck size={14} />
            {t("register.localFirst")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-graph-line bg-kivu-paper px-3 py-2">
            <MapPin size={14} />
            {t("register.fieldReady")}
          </span>
        </div>
      </div>

      <form id="field-register-form" onSubmit={onSubmit} className="space-y-4">
        {saveError && <div className="rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">{saveError}</div>}
        {sections.map(({ section, fields }) => (
          <section key={section} className="rounded-lg border border-graph-line bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 border-b border-graph-line pb-3">
              <h2 className="font-display text-lg font-semibold tracking-tight text-ink-black">{sectionLabel(section)}</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {fields.map((field) => (
                <FieldRenderer
                  key={field.id || field.key}
                  field={field}
                  value={values[field.key]}
                  error={errors[field.key]}
                  language={i18n.language}
                  attachmentContext={{ orgId: user?.orgId, workflowId: activeWorkflow.id, recordId: recordId }}
                  onChange={(value) => setFieldValue(field.key, value)}
                />
              ))}
            </div>
          </section>
        ))}
      </form>

      <div className="sticky bottom-24 z-10 mt-4 rounded-lg border border-graph-line bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:bottom-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-pencil">{t("register.saveHint")}</p>
          <Button type="submit" form="field-register-form" variant="primary" size="lg" className="w-full shrink-0 sm:w-auto" loading={saving} disabled={!user?.orgId || fields.length === 0}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  )
}
