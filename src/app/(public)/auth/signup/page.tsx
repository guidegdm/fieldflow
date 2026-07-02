"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ArrowRight, Loader2, ShieldCheck, UserPlus } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuthStore } from "@/stores/authStore"
import { Select } from "@/components/ui/select"
import { WORKSPACE_SECTORS } from "@/lib/workspaces/sectors"
import { COGNITO_PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy"

const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1),
  password: z.string().regex(COGNITO_PASSWORD_REQUIREMENT, "passwordPolicy"),
  orgName: z.string().trim().min(1),
  orgSector: z.enum(WORKSPACE_SECTORS),
})

type SignUpValues = z.infer<typeof signUpSchema>

export default function SignUpPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const setAuthFromApi = useAuthStore((s) => s.setAuthFromApi)
  const [error, setError] = useState("")
  const [pendingSignup, setPendingSignup] = useState<SignUpValues | null>(null)
  const [verificationCode, setVerificationCode] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [redirectingGoogle, setRedirectingGoogle] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", name: "", password: "", orgName: "", orgSector: "humanitarian" },
  })

  const onSubmit = async ({ email, name, password, orgName, orgSector }: SignUpValues) => {
    setError("")

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, name, password, orgName, orgSector }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null
        setError(data?.error || t("signup.errors.default"))
        return
      }

      const data = await res.json()
      if (data.requiresConfirmation) {
        setPendingSignup({ email, name, password, orgName, orgSector })
        return
      }
      if (data.user && data.org) setAuthFromApi(data.user, data.org, data.orgs)
      router.push(data.redirect || "/auth/signin")
    } catch {
      setError(t("signup.errors.network"))
    }
  }

  const confirmSignup = async () => {
    if (!pendingSignup || !verificationCode.trim()) return
    setConfirming(true)
    setError("")
    try {
      const res = await fetch("/api/auth/confirm-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...pendingSignup, code: verificationCode.trim() }),
      })
      if (!res.ok) {
        setError(t("signup.errors.confirm"))
        return
      }
      const data = await res.json()
      if (data.user && data.org) setAuthFromApi(data.user, data.org, data.orgs)
      router.push(data.redirect || "/admin/dashboard")
    } catch {
      setError(t("signup.errors.network"))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] w-full max-w-6xl items-start gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:py-10">
        <section className="hidden lg:flex lg:min-h-[calc(100dvh-5rem)] lg:items-start lg:pt-12 xl:pt-16">
          <div className="max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pencil">{t("signup.heroEyebrow")}</p>
            <h1 className="mt-5 font-display text-5xl font-bold leading-[0.98] tracking-tight text-lake-deep xl:text-6xl">
              {t("signup.heroTitle")}
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-soil xl:text-xl">
              {t("signup.heroBody")}
            </p>
          </div>
        </section>

        <main className="mx-auto flex w-full max-w-md items-start lg:max-w-lg">
          <div className="w-full">
          <div className="mb-6 text-center lg:hidden">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pencil">{t("signup.heroEyebrow")}</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-lake-deep">
              {t("signup.heroTitle")}
            </h1>
            <p className="mt-3 text-sm leading-6 text-soil">{t("signup.heroBody")}</p>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-lake-deep">
                  {pendingSignup ? t("signup.verifyTitle") : t("signup.title")}
                </h2>
                <p className="mt-1 text-sm text-pencil">
                  {pendingSignup ? t("signup.verifySubtitle", { email: pendingSignup.email }) : t("signup.subtitle")}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-blue/10 text-ink-blue">
                <ShieldCheck size={18} />
              </div>
            </div>

          {error && (
            <div className="mt-4 rounded-md bg-danger-500/10 border border-danger-500/30 px-4 py-2 text-sm text-danger-500">
              {error}
            </div>
          )}

          {pendingSignup ? (
            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-soil mb-1">
                  {t("signup.verificationCode")}
                </label>
                <input
                  id="verificationCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  className="h-11 w-full rounded-md border border-graph-line px-3 text-base tracking-[0.2em] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ink-blue sm:text-sm"
                />
              </div>
              <button
                type="button"
                disabled={confirming || !verificationCode.trim()}
                onClick={confirmSignup}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink-blue text-sm font-semibold text-white transition-colors hover:bg-ink-blue/90 disabled:opacity-60"
              >
                {confirming && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
                {confirming ? t("signup.verifying") : t("signup.verifySubmit")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingSignup(null)
                  setVerificationCode("")
                }}
                className="h-10 w-full rounded-md border border-graph-line text-sm font-medium text-pencil transition-colors hover:bg-graph-paper hover:text-ink-black"
              >
                {t("common.back")}
              </button>
            </div>
          ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-soil mb-1">
                {t("signup.email")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                aria-invalid={!!errors.email}
                className="h-11 w-full rounded-md border border-graph-line px-3 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ink-blue sm:text-sm"
              />
              {errors.email && <p className="mt-1 text-sm text-danger-500">{t("common.required")}</p>}
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-soil mb-1">
                {t("signup.name")}
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                {...register("name")}
                aria-invalid={!!errors.name}
                className="h-11 w-full rounded-md border border-graph-line px-3 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ink-blue sm:text-sm"
              />
              {errors.name && <p className="mt-1 text-sm text-danger-500">{t("common.required")}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-soil mb-1">
                {t("signup.password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
                aria-invalid={!!errors.password}
                className="h-11 w-full rounded-md border border-graph-line px-3 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ink-blue sm:text-sm"
              />
              <p className="mt-1 text-xs leading-5 text-pencil">
                {t("signup.passwordHelp")}
              </p>
              {errors.password && (
                <p className="mt-1 text-sm text-danger-500">
                  {errors.password.message === "passwordPolicy" ? t("signup.errors.passwordPolicy") : t("common.required")}
                </p>
              )}
            </div>

            <hr className="border-grid-line" />

            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-soil mb-1">
                {t("signup.orgName")}
              </label>
              <input
                id="orgName"
                type="text"
                {...register("orgName")}
                aria-invalid={!!errors.orgName}
                className="h-11 w-full rounded-md border border-graph-line px-3 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ink-blue sm:text-sm"
              />
              {errors.orgName && <p className="mt-1 text-sm text-danger-500">{t("common.required")}</p>}
            </div>
            <div>
              <label htmlFor="orgSector" className="block text-sm font-medium text-soil mb-1">
                {t("signup.orgSector")}
              </label>
              <Select
                id="orgSector"
                {...register("orgSector")}
                className="h-10"
              >
                {WORKSPACE_SECTORS.map((sector) => (
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
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <UserPlus size={16} />}
              {isSubmitting ? t("signup.submitting") : t("signup.submit")}
            </button>
          </form>
          )}

          {!pendingSignup && <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-graph-line" />
            <span className="text-xs font-medium text-pencil">{t("common.or", "or")}</span>
            <div className="h-px flex-1 bg-graph-line" />
          </div>}

          {!pendingSignup && <button
            type="button"
            disabled={redirectingGoogle}
            onClick={() => {
              setRedirectingGoogle(true)
              window.location.href = "/api/auth/oauth/google?mode=signup"
            }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-graph-line text-sm font-semibold text-ink-black transition-colors hover:bg-graph-paper disabled:opacity-60"
          >
            {redirectingGoogle && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
            {t("signup.google")}
          </button>}

          {!pendingSignup && <p className="mt-6 text-center text-xs text-pencil">
            {t("signup.hasAccount")}{" "}
            <Link href="/auth/signin" className="inline-flex items-center gap-1 font-semibold text-ink-blue hover:underline">
              {t("signup.signin")}
              <ArrowRight size={12} />
            </Link>
          </p>}
          </div>
        </div>
        </main>
      </div>
    </div>
  )
}
