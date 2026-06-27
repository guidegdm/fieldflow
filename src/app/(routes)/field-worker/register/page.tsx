'use client'

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, CheckCircle } from "lucide-react"
import { generateId } from "@/lib/utils"
import { db } from "@/lib/db/indexeddb"
import type { MutationEntry } from "@/types/sync"
import type { RecordData } from "@/types/record"
import { useAuthStore } from "@/stores/authStore"
import { useSyncStore } from "@/stores/syncStore"

const SHELTER_OPTIONS = ["tente", "abri", "maison", "centre", "famille"] as const
const NEED_OPTIONS = ["nourriture", "eau", "abri", "medical", "education", "protection"] as const

const registerSchema = z.object({
  household_name: z.string().min(1),
  head_of_household: z.string().min(1),
  household_size: z.string().min(1).refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0),
  shelter_type: z.string().min(1),
  village: z.string().min(1),
  location: z.string(),
  vulnerability_score: z.number().min(1).max(5),
  needs: z.array(z.string()),
  notes: z.string(),
})

type RegistrationForm = z.infer<typeof registerSchema>

const INITIAL_FORM: RegistrationForm = {
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
  const user = useAuthStore((state) => state.user)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState("")
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<RegistrationForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: INITIAL_FORM,
  })

  const vulnerabilityScore = watch("vulnerability_score")
  const selectedNeeds = watch("needs")

  function toggleNeed(need: string) {
    setValue(
      "needs",
      selectedNeeds.includes(need) ? selectedNeeds.filter((n) => n !== need) : [...selectedNeeds, need],
      { shouldDirty: true, shouldValidate: true },
    )
  }

  async function onSubmit(form: RegistrationForm) {
    if (!user?.orgId) {
      setSaveError(t("register.sessionRequired"))
      return
    }

    const id = generateId()
    const now = Date.now()
    const deviceId = user.deviceId || "web"

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
      setSaveError("")
      await db.putRecord(record)
      await db.enqueueMutation(mutation)
      useSyncStore.getState().setPendingCount((await db.getPendingMutations()).length)
      setSaved(true)
    } catch {
      setSaveError(t("register.saveFailed"))
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
    <div className="mx-auto max-w-3xl pb-28 lg:pb-0">
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

      <form id="field-register-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {saveError && (
          <div className="rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
            {saveError}
          </div>
        )}

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink-black border-b border-graph-line pb-2 mb-4">
            {t("register.identification")}
          </h2>

          <div className="space-y-5">
            <FieldWrapper
              label={t("records.householdName")}
              required
              error={errors.household_name ? t("common.required") : undefined}
            >
              <Input
                {...register("household_name")}
                error={errors.household_name ? t("common.required") : undefined}
                className="h-11"
              />
            </FieldWrapper>

            <FieldWrapper
              label={t("records.headOfHousehold")}
              required
              error={errors.head_of_household ? t("common.required") : undefined}
            >
              <Input
                {...register("head_of_household")}
                error={errors.head_of_household ? t("common.required") : undefined}
                className="h-11"
              />
            </FieldWrapper>

            <FieldWrapper
              label={t("records.householdSize")}
              required
              error={errors.household_size ? t("common.required") : undefined}
            >
              <Input
                type="number"
                min="1"
                {...register("household_size")}
                error={errors.household_size ? t("common.required") : undefined}
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
              error={errors.shelter_type ? t("common.required") : undefined}
            >
              <Select
                {...register("shelter_type")}
                error={errors.shelter_type ? t("common.required") : undefined}
              >
                <option value="">—</option>
                {SHELTER_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{t(`register.shelter_${opt}`)}</option>
                ))}
              </Select>
            </FieldWrapper>

            <FieldWrapper
              label={t("records.village")}
              required
              error={errors.village ? t("common.required") : undefined}
            >
              <Input
                {...register("village")}
                error={errors.village ? t("common.required") : undefined}
                className="h-11"
              />
            </FieldWrapper>

            <FieldWrapper label={t("records.location", "Adresse / Lieu")}>
              <Input
                {...register("location")}
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
                  {...register("vulnerability_score", { valueAsNumber: true })}
                  className="flex-1 accent-ink-blue h-11"
                />
                <span className="text-sm font-mono text-ink-black min-w-[1.5rem] text-center">
                  {vulnerabilityScore}/5
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
                    className="flex items-center gap-3 min-h-[48px] cursor-pointer rounded-md px-3 hover:bg-graph-paper"
                  >
                    <input
                      type="checkbox"
                      checked={selectedNeeds.includes(need)}
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
                {...register("notes")}
                className="min-h-[80px]"
              />
            </FieldWrapper>
          </div>
        </section>
      </form>

      <div className="fixed bottom-16 left-0 right-0 z-50 border-t border-graph-line bg-white p-4 lg:sticky lg:bottom-0 lg:mt-8 lg:rounded-md lg:border lg:px-4">
        <div className="mx-auto flex max-w-3xl justify-end">
          <Button
            type="submit"
            form="field-register-form"
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
            loading={isSubmitting}
            disabled={!user?.orgId}
          >
            {t("common.save")}
          </Button>
        </div>
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
