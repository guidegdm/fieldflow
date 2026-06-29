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
import { ArrowLeft, CheckCircle, ClipboardList, MapPin, ShieldCheck } from "lucide-react"
import { generateId } from "@/lib/utils"
import { db } from "@/lib/db/indexeddb"
import { runBackgroundSync } from "@/lib/sync/run-background-sync"
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
    <div className="mx-auto max-w-5xl pb-28 lg:pb-8">
      <div className="mb-5 flex flex-col gap-4 rounded-lg border border-graph-line bg-white px-4 py-4 shadow-sm sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <button
            onClick={() => router.back()}
            className="mb-3 inline-flex min-h-9 items-center gap-2 rounded-md px-1 text-sm text-pencil transition-colors hover:text-ink-black"
          >
            <ArrowLeft size={17} />
            {t("common.back")}
          </button>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink-blue/10 text-ink-blue">
              <ClipboardList size={20} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-black sm:text-3xl">
                {t("records.newRegistration")}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-pencil">
                {t("register.formIntro")}
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

      <form id="field-register-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {saveError && (
          <div className="rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
            {saveError}
          </div>
        )}

        <section className="rounded-lg border border-graph-line bg-white p-4 shadow-sm sm:p-5">
          <SectionHeading title={t("register.identification")} subtitle={t("register.identificationHint")} />
          <div className="grid gap-4 md:grid-cols-2">
            <FieldWrapper
              label={t("records.householdName")}
              required
              error={errors.household_name ? t("common.required") : undefined}
            >
              <Input
                {...register("household_name")}
                error={errors.household_name ? t("common.required") : undefined}
                className="h-11 bg-white"
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
                className="h-11 bg-white"
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
                className="h-11 bg-white"
              />
            </FieldWrapper>
          </div>
        </section>

        <section className="rounded-lg border border-graph-line bg-white p-4 shadow-sm sm:p-5">
          <SectionHeading title={t("register.livingConditions")} subtitle={t("register.livingConditionsHint")} />
          <div className="grid gap-4 md:grid-cols-2">
            <FieldWrapper
              label={t("records.shelterType")}
              required
              error={errors.shelter_type ? t("common.required") : undefined}
            >
              <Select
                {...register("shelter_type")}
                error={errors.shelter_type ? t("common.required") : undefined}
                className="h-11 bg-white"
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
                className="h-11 bg-white"
              />
            </FieldWrapper>

            <FieldWrapper label={t("records.location", t("register.location"))}>
              <Input
                {...register("location")}
                placeholder={t("register.locationPlaceholder")}
                className="h-11 bg-white"
              />
            </FieldWrapper>
          </div>
        </section>

        <section className="rounded-lg border border-graph-line bg-white p-4 shadow-sm sm:p-5">
          <SectionHeading title={t("register.needs")} subtitle={t("register.needsHint")} />
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
                <span className="rounded-md border border-graph-line bg-kivu-paper px-2 py-1 text-sm font-mono text-ink-black min-w-[3rem] text-center">
                  {vulnerabilityScore}/5
                </span>
              </div>
            </div>

            <div className="min-h-[48px]">
              <label className="block text-sm font-medium text-pencil mb-1">
                {t("records.needs")}
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {NEED_OPTIONS.map((need) => (
                  <label
                    key={need}
                    className="flex min-h-[46px] cursor-pointer items-center gap-3 rounded-md border border-graph-line bg-white px-3 transition-colors hover:border-ink-blue/30 hover:bg-graph-paper"
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
                className="min-h-[96px] bg-white"
              />
            </FieldWrapper>
          </div>
        </section>
      </form>

      <div className="sticky bottom-24 z-10 mt-4 rounded-lg border border-graph-line bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:bottom-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-pencil">
            {t("register.saveHint")}
          </p>
          <Button
            type="submit"
            form="field-register-form"
            variant="primary"
            size="lg"
            className="w-full shrink-0 sm:w-auto"
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

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 border-b border-graph-line pb-3">
      <h2 className="font-display text-lg font-semibold tracking-tight text-ink-black">
        {title}
      </h2>
      <p className="mt-1 text-xs leading-5 text-pencil">
        {subtitle}
      </p>
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
  const { t } = useTranslation()

  return (
    <div className="min-h-[48px]">
      <label className="block text-sm font-medium text-pencil mb-1">
        {label}
        {required && (
          <>
            <span className="text-danger-500 ml-0.5">*</span>
            <span className="text-pencil-light text-xs ml-1 font-normal">
              ({t("common.required").toLowerCase()})
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
