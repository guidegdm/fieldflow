'use client'

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, CheckCircle } from "lucide-react"
import { generateId } from "@/lib/utils"
import { db } from "@/lib/db/indexeddb"
import type { MutationEntry } from "@/types/sync"
import type { RecordData } from "@/types/record"

const SHELTER_OPTIONS = ["tente", "abri", "maison", "centre", "famille"] as const
const NEED_OPTIONS = ["nourriture", "eau", "abri", "medical", "education", "protection"] as const

interface FormData {
  household_name: string
  head_of_household: string
  household_size: string
  shelter_type: string
  village: string
  location: string
  vulnerability_score: number
  needs: string[]
  notes: string
}

const INITIAL_FORM: FormData = {
  household_name: "",
  head_of_household: "",
  household_size: "",
  shelter_type: "",
  village: "",
  location: "",
  vulnerability_score: 1,
  needs: [],
  notes: "",
}

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function toggleNeed(need: string) {
    setForm((prev) => ({
      ...prev,
      needs: prev.needs.includes(need) ? prev.needs.filter((n) => n !== need) : [...prev.needs, need],
    }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.household_name.trim()) errs.household_name = t("common.required")
    if (!form.head_of_household.trim()) errs.head_of_household = t("common.required")
    if (!form.household_size.trim() || isNaN(Number(form.household_size))) errs.household_size = t("common.required")
    if (!form.shelter_type) errs.shelter_type = t("common.required")
    if (!form.village.trim()) errs.village = t("common.required")
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)

    const id = generateId()
    const now = Date.now()

    const record: RecordData = {
      id,
      workflowId: "wf-1",
      workflowVersion: 2,
      entityKey: "household",
      status: "draft",
      syncStatus: "local",
      state: "draft",
      fields: { ...form },
      createdAt: now,
      updatedAt: now,
      createdBy: "user-1",
      deviceId: "device-a",
      version: 1,
    }

    const mutation: MutationEntry = {
      client_id: id,
      device_id: "device-a",
      operation: "create",
      resource: "record",
      workflow_id: "wf-1",
      record_id: id,
      payload: record,
      client_timestamp: now,
      base_version: 0,
      status: "PENDING",
      retry_count: 0,
      last_error: null,
      enqueued_at: now,
    }

    try {
      await db.putRecord(record)
      await db.enqueueMutation(mutation)
      setSaved(true)
    } catch {
      console.error("Failed to save record")
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-4 min-h-[60vh]">
        <div className="w-16 h-16 rounded-full bg-success-500/10 flex items-center justify-center mb-4">
          <CheckCircle size={32} className="text-success-500" />
        </div>
        <h2 className="font-display text-xl font-bold text-ink-black mb-1">
          {t("register.savedLocally")}
        </h2>
        <p className="text-sm text-pencil mb-6 max-w-xs">
          {t("register.successMessage")}
        </p>
        <Button
          variant="primary"
          size="lg"
          className="w-full max-w-xs"
          onClick={() => router.push("/field-worker/home")}
        >
          {t("common.back")}
        </Button>
      </div>
    )
  }

  return (
    <div className="pb-28">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-pencil min-h-[48px]"
      >
        <ArrowLeft size={18} />
        {t("common.back")}
      </button>

      <h1 className="font-serif text-2xl font-bold text-ink-black mt-2 mb-6">
        {t("records.newRegistration")}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section>
          <h2 className="font-serif text-lg font-semibold text-ink-black border-b border-graph-line pb-2 mb-4">
            {t("register.identification")}
          </h2>

          <div className="space-y-5">
            <FieldWrapper
              label={t("records.householdName")}
              required
              error={errors.household_name}
            >
              <Input
                name="household_name"
                value={form.household_name}
                onChange={(e) => update("household_name", e.target.value)}
                error={errors.household_name}
                className="h-11"
              />
            </FieldWrapper>

            <FieldWrapper
              label={t("records.headOfHousehold")}
              required
              error={errors.head_of_household}
            >
              <Input
                name="head_of_household"
                value={form.head_of_household}
                onChange={(e) => update("head_of_household", e.target.value)}
                error={errors.head_of_household}
                className="h-11"
              />
            </FieldWrapper>

            <FieldWrapper
              label={t("records.householdSize")}
              required
              error={errors.household_size}
            >
              <Input
                name="household_size"
                type="number"
                min="1"
                value={form.household_size}
                onChange={(e) => update("household_size", e.target.value)}
                error={errors.household_size}
                className="h-11"
              />
            </FieldWrapper>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink-black border-b border-graph-line pb-2 mb-4">
            {t("register.livingConditions")}
          </h2>

          <div className="space-y-5">
            <FieldWrapper
              label={t("records.shelterType")}
              required
              error={errors.shelter_type}
            >
              <select
                name="shelter_type"
                value={form.shelter_type}
                onChange={(e) => update("shelter_type", e.target.value)}
                className="h-11 w-full rounded-md border border-graph-line bg-white px-3 py-2 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue"
              >
                <option value="">—</option>
                {SHELTER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{t(`register.shelter_${opt}`)}</option>
                ))}
              </select>
            </FieldWrapper>

            <FieldWrapper
              label={t("records.village")}
              required
              error={errors.village}
            >
              <Input
                name="village"
                value={form.village}
                onChange={(e) => update("village", e.target.value)}
                error={errors.village}
                className="h-11"
              />
            </FieldWrapper>

            <FieldWrapper label={t("records.location", "Adresse / Lieu")}>
              <Input
                name="location"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder={t("register.locationPlaceholder", "Ex: Camp Mugunga, Goma")}
                className="h-11"
              />
            </FieldWrapper>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink-black border-b border-graph-line pb-2 mb-4">
            {t("register.needs")}
          </h2>

          <div className="space-y-5">
            <div className="min-h-[48px]">
              <label className="block text-sm font-medium text-pencil mb-1">
                {t("records.vulnerabilityScore")}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={form.vulnerability_score}
                  onChange={(e) => update("vulnerability_score", Number(e.target.value))}
                  className="flex-1 accent-ink-blue h-11"
                />
                <span className="text-sm font-mono text-ink-black min-w-[1.5rem] text-center">
                  {form.vulnerability_score}/5
                </span>
              </div>
            </div>

            <div className="min-h-[48px]">
              <label className="block text-sm font-medium text-pencil mb-1">
                {t("records.needs")}
              </label>
              <div className="space-y-1">
                {NEED_OPTIONS.map((need) => (
                  <label
                    key={need}
                    className="flex items-center gap-3 min-h-[48px] cursor-pointer rounded-md px-3 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.needs.includes(need)}
                      onChange={() => toggleNeed(need)}
                      className="w-4 h-4 rounded border-graph-line text-ink-blue accent-ink-blue"
                    />
                    <span className="text-sm text-ink-black">
                      {t(`register.need_${need}`)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <FieldWrapper label={t("records.notes")}>
              <Textarea
                name="notes"
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                className="min-h-[80px]"
              />
            </FieldWrapper>
          </div>
        </section>
      </form>

      <div className="fixed bottom-16 left-0 right-0 z-50 border-t border-graph-line bg-white p-4">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={saving}
          onClick={handleSubmit}
        >
          {t("common.save")}
        </Button>
      </div>
    </div>
  )
}

interface FieldWrapperProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

function FieldWrapper({ label, required, error, children }: FieldWrapperProps) {
  return (
    <div className="min-h-[48px]">
      <label className="block text-sm font-medium text-pencil mb-1">
        {label}
        {required && (
          <>
            <span className="text-danger-500 ml-0.5">*</span>
            <span className="text-pencil-light text-xs ml-1 font-normal">
              (obligatoire)
            </span>
          </>
        )}
      </label>
      {children}
      {error && (
        <p className="text-sm text-danger-500 mt-1">{error}</p>
      )}
    </div>
  )
}
