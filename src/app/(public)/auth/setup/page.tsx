"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Select } from "@/components/ui/select"
import { useAuthStore } from "@/stores/authStore"

const SECTORS = ["humanitaire", "sante", "agriculture", "education"] as const

const setupSchema = z.object({
  orgName: z.string().min(1),
  orgSector: z.enum(SECTORS),
})

type SetupValues = z.infer<typeof setupSchema>

export default function AuthSetupPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const setAuthFromApi = useAuthStore((s) => s.setAuthFromApi)
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { orgName: "", orgSector: "humanitaire" },
  })

  useEffect(() => {
    let cancelled = false
    async function loadSetup() {
      try {
        const res = await fetch("/api/auth/setup", { credentials: "include" })
        if (!res.ok) {
          if (!cancelled) setError(t("setup.errors.missing"))
          return
        }
        const data = await res.json()
        if (!cancelled) setEmail(data.user?.email || "")
      } catch {
        if (!cancelled) setError(t("setup.errors.network"))
      }
    }
    loadSetup()
    return () => { cancelled = true }
  }, [t])

  const onSubmit = async ({ orgName, orgSector }: SetupValues) => {
    setError("")

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgName, orgSector }),
      })

      if (!res.ok) {
        setError(t(res.status === 401 ? "setup.errors.missing" : "setup.errors.default"))
        return
      }

      const data = await res.json()
      setAuthFromApi(data.user, data.org, data.orgs)
      router.push(data.redirect || "/admin/dashboard")
    } catch {
      setError(t("setup.errors.network"))
    }
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pencil">{t("setup.heroEyebrow")}</p>
            <h1 className="mt-5 font-display text-6xl font-bold leading-none tracking-tight text-lake-deep">
              {t("setup.heroTitle")}
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-soil">
              {t("setup.heroBody")}
            </p>
          </div>
        </section>

        <main className="mx-auto w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pencil">{t("setup.heroEyebrow")}</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-lake-deep">
              {t("setup.heroTitle")}
            </h1>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-lake-deep">
                  {t("setup.title")}
                </h2>
                <p className="mt-1 text-sm text-pencil">{t("setup.subtitle")}</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-blue/10 text-ink-blue">
                <ShieldCheck size={18} />
              </div>
            </div>

            {email && (
              <p className="mt-4 rounded-md border border-graph-line bg-graph-paper px-3 py-2 text-xs font-medium text-pencil">
                {t("setup.signedInAs", { email })}
              </p>
            )}

            {error && (
              <div className="mt-4 rounded-md border border-danger-500/30 bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
                {error}
              </div>
            )}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <label htmlFor="orgName" className="mb-1 block text-sm font-medium text-soil">
                  {t("setup.orgName")}
                </label>
                <input
                  id="orgName"
                  type="text"
                  autoComplete="organization"
                  {...register("orgName")}
                  aria-invalid={!!errors.orgName}
                  className="h-11 w-full rounded-md border border-graph-line px-3 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ink-blue sm:text-sm"
                />
                {errors.orgName && <p className="mt-1 text-sm text-danger-500">{t("common.required")}</p>}
              </div>

              <div>
                <label htmlFor="orgSector" className="mb-1 block text-sm font-medium text-soil">
                  {t("setup.orgSector")}
                </label>
                <Select id="orgSector" {...register("orgSector")}>
                  {SECTORS.map((sector) => (
                    <option key={sector} value={sector}>
                      {t(`signup.sectors.${sector}`)}
                    </option>
                  ))}
                </Select>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink-blue text-sm font-semibold text-white transition-colors hover:bg-ink-blue/90 disabled:opacity-60"
              >
                {isSubmitting ? t("setup.submitting") : t("setup.submit")}
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
