'use client'

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, ArrowLeft } from "lucide-react"
import { generateId } from "@/lib/utils"

const SHELTER_OPTIONS = ["tente", "abri", "maison", "centre", "famille"] as const
const NEED_OPTIONS = ["nourriture", "eau", "abri", "medical", "education", "protection"] as const

interface FormData {
  household_name: string
  head_of_household: string
  household_size: string
  shelter_type: string
  village: string
  latitude: string
  longitude: string
  vulnerability_score: number
  needs: string[]
}

const INITIAL_FORM: FormData = {
  household_name: "",
  head_of_household: "",
  household_size: "",
  shelter_type: "",
  village: "",
  latitude: "",
  longitude: "",
  vulnerability_score: 1,
  needs: [],
}

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [saved, setSaved] = useState(false)

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    const id = generateId()
    const record = {
      id,
      workflowId: "wf-1",
      workflowVersion: 2,
      entityKey: "household",
      status: "draft" as const,
      syncStatus: "local" as const,
      state: "draft",
      fields: { ...form },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: "user-1",
      deviceId: "device-a",
      version: 1,
    }

    try {
      const existing = JSON.parse(localStorage.getItem("fieldflow-registrations") || "[]")
      existing.unshift(record)
      localStorage.setItem("fieldflow-registrations", JSON.stringify(existing))
    } catch { /* localStorage unavailable */ }

    setSaved(true)
  }

  if (saved) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-success-500/10 flex items-center justify-center mb-4">
          <CheckCircle size={32} className="text-success-500" />
        </div>
        <h2 className="font-display text-xl font-bold text-ink-black mb-1">{t("register.savedLocally")}</h2>
        <p className="text-sm text-pencil mb-6 max-w-xs">{t("register.successMessage")}</p>
        <Button variant="primary" onClick={() => router.push("/field-worker/home")}>
          {t("common.back")}
        </Button>
      </div>
    )
  }

  return (
    <div className="py-4">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-pencil mb-4 min-h-[44px]">
        <ArrowLeft size={16} />
        {t("common.back")}
      </button>

      <h1 className="font-display text-2xl font-bold text-ink-black tracking-tight mb-6">{t("records.newRegistration")}</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-pencil pb-2 mb-4 border-b border-graph-line">
            {t("register.identification")}
          </h2>
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <label className="text-[11px] uppercase text-pencil font-medium min-w-[7rem] text-right shrink-0">{t("records.householdName")}</label>
              <span className="flex-1 border-b border-dotted border-grid-line min-w-0" />
              <Input
                name="household_name"
                value={form.household_name}
                onChange={(e) => update("household_name", e.target.value)}
                error={errors.household_name}
                className="flex-1 border-0 border-b border-dotted border-grid-line rounded-none px-0 text-base bg-transparent focus-visible:ring-0 focus-visible:border-ink-blue"
              />
            </div>
            <div className="flex items-baseline gap-2">
              <label className="text-[11px] uppercase text-pencil font-medium min-w-[7rem] text-right shrink-0">{t("records.headOfHousehold")}</label>
              <span className="flex-1 border-b border-dotted border-grid-line min-w-0" />
              <Input
                name="head_of_household"
                value={form.head_of_household}
                onChange={(e) => update("head_of_household", e.target.value)}
                error={errors.head_of_household}
                className="flex-1 border-0 border-b border-dotted border-grid-line rounded-none px-0 text-base bg-transparent focus-visible:ring-0 focus-visible:border-ink-blue"
              />
            </div>
            <div className="flex items-baseline gap-2">
              <label className="text-[11px] uppercase text-pencil font-medium min-w-[7rem] text-right shrink-0">{t("records.householdSize")}</label>
              <span className="flex-1 border-b border-dotted border-grid-line min-w-0" />
              <Input
                name="household_size"
                type="number"
                min="1"
                value={form.household_size}
                onChange={(e) => update("household_size", e.target.value)}
                error={errors.household_size}
                className="flex-1 border-0 border-b border-dotted border-grid-line rounded-none px-0 text-base bg-transparent focus-visible:ring-0 focus-visible:border-ink-blue"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-pencil pb-2 mb-4 border-b border-graph-line">
            {t("register.livingConditions")}
          </h2>
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <label className="text-[11px] uppercase text-pencil font-medium min-w-[7rem] text-right shrink-0">{t("records.shelterType")}</label>
              <span className="flex-1 border-b border-dotted border-grid-line min-w-0" />
              <select
                name="shelter_type"
                value={form.shelter_type}
                onChange={(e) => update("shelter_type", e.target.value)}
                className="flex-1 border-0 border-b border-dotted border-grid-line rounded-none px-0 py-2 text-base bg-transparent text-ink-black focus-visible:outline-none focus-visible:border-ink-blue"
              >
                <option value="">—</option>
                {SHELTER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{t(`register.shelter_${opt}`)}</option>
                ))}
              </select>
            </div>
            {errors.shelter_type && <p className="text-sm text-danger-500 pl-[7rem]">{errors.shelter_type}</p>}
            <div className="flex items-baseline gap-2">
              <label className="text-[11px] uppercase text-pencil font-medium min-w-[7rem] text-right shrink-0">{t("records.village")}</label>
              <span className="flex-1 border-b border-dotted border-grid-line min-w-0" />
              <Input
                name="village"
                value={form.village}
                onChange={(e) => update("village", e.target.value)}
                error={errors.village}
                className="flex-1 border-0 border-b border-dotted border-grid-line rounded-none px-0 text-base bg-transparent focus-visible:ring-0 focus-visible:border-ink-blue"
              />
            </div>
            <div className="flex items-baseline gap-2">
              <label className="text-[11px] uppercase text-pencil font-medium min-w-[7rem] text-right shrink-0">{t("records.gpsCoordinates")}</label>
              <span className="flex-1 border-b border-dotted border-grid-line min-w-0" />
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder={t("register.latitude")}
                  value={form.latitude}
                  onChange={(e) => update("latitude", e.target.value)}
                  className="border-0 border-b border-dotted border-grid-line rounded-none px-0 text-base bg-transparent focus-visible:ring-0 focus-visible:border-ink-blue"
                />
                <Input
                  placeholder={t("register.longitude")}
                  value={form.longitude}
                  onChange={(e) => update("longitude", e.target.value)}
                  className="border-0 border-b border-dotted border-grid-line rounded-none px-0 text-base bg-transparent focus-visible:ring-0 focus-visible:border-ink-blue"
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-pencil pb-2 mb-4 border-b border-graph-line">
            {t("register.needs")}
          </h2>
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <label className="text-[11px] uppercase text-pencil font-medium min-w-[7rem] text-right shrink-0">{t("records.vulnerabilityScore")}</label>
              <span className="flex-1 border-b border-dotted border-grid-line min-w-0" />
              <div className="flex-1 flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={form.vulnerability_score}
                  onChange={(e) => update("vulnerability_score", Number(e.target.value))}
                  className="flex-1 accent-ink-blue"
                />
                <span className="text-sm font-mono text-ink-black min-w-[1.5rem] text-center">{form.vulnerability_score}/5</span>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <label className="text-[11px] uppercase text-pencil font-medium min-w-[7rem] text-right shrink-0 self-start pt-2">{t("records.needs")}</label>
              <span className="flex-1 border-b border-dotted border-grid-line min-w-0 self-start mt-3" />
              <div className="flex-1 space-y-2 py-1">
                {NEED_OPTIONS.map((need) => (
                  <label key={need} className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.needs.includes(need)}
                      onChange={() => toggleNeed(need)}
                      className="w-4 h-4 rounded border-grid-line text-ink-blue accent-ink-blue"
                    />
                    <span className="text-sm text-ink-black">{t(`register.need_${need}`)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Button type="submit" variant="primary" size="lg" className="w-full">
          {t("common.save")}
        </Button>
      </form>
    </div>
  )
}
