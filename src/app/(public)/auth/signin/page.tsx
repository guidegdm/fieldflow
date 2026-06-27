"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ArrowRight, LogIn, ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuthStore } from "@/stores/authStore"

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const otpSchema = z.object({
  code: z.string().min(4).max(12),
})

type SignInValues = z.infer<typeof signInSchema>
type OtpValues = z.infer<typeof otpSchema>
type AuthChallenge = { challengeName: "EMAIL_OTP" | "SMS_MFA" | "SOFTWARE_TOKEN_MFA"; session: string; email: string } | null

export default function SignInPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const setAuthFromApi = useAuthStore((s) => s.setAuthFromApi)
  const [error, setError] = useState("")
  const [challenge, setChallenge] = useState<AuthChallenge>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  })
  const { register: registerOtp, handleSubmit: handleOtpSubmit, formState: { errors: otpErrors, isSubmitting: otpSubmitting } } = useForm<OtpValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  })

  const onSubmit = async ({ email, password }: SignInValues) => {
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        setError(t("signin.errors.default"))
        return
      }

      const data = await res.json()
      if (data.challenge && data.session) {
        setChallenge({ challengeName: data.challenge, session: data.session, email: data.email || email })
        return
      }
      setAuthFromApi(data.user, data.org, data.orgs)
      router.push(data.user.role === "field_worker" ? "/field-worker/home" : "/supervisor/dashboard")
    } catch {
      setError(t("signin.errors.network"))
    }
  }

  const onOtpSubmit = async ({ code }: OtpValues) => {
    if (!challenge) return
    setError("")

    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...challenge, code }),
      })

      if (!res.ok) {
        setError(t("signin.errors.invalidCode"))
        return
      }

      const data = await res.json()
      setAuthFromApi(data.user, data.org, data.orgs)
      router.push(data.user.role === "field_worker" ? "/field-worker/home" : data.user.role === "supervisor" ? "/supervisor/dashboard" : "/admin/dashboard")
    } catch {
      setError(t("signin.errors.network"))
    }
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pencil">{t("signin.heroEyebrow")}</p>
            <h1 className="mt-5 font-display text-6xl font-bold leading-none tracking-tight text-lake-deep">
              {t("signin.heroTitle")}
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-soil">
              {t("signin.heroBody")}
            </p>
          </div>
        </section>

        <main className="mx-auto w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-pencil">{t("signin.heroEyebrow")}</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-lake-deep">
              {t("signin.heroTitle")}
            </h1>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-lake-deep">
                  {t("signin.title")}
                </h2>
                <p className="mt-1 text-sm text-pencil">{t("signin.subtitle")}</p>
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

          {!challenge ? (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-soil mb-1">
                {t("signin.email")}
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
              <label htmlFor="password" className="block text-sm font-medium text-soil mb-1">
                {t("signin.password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
                aria-invalid={!!errors.password}
                className="h-11 w-full rounded-md border border-graph-line px-3 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ink-blue sm:text-sm"
              />
              {errors.password && <p className="mt-1 text-sm text-danger-500">{t("common.required")}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink-blue text-sm font-semibold text-white transition-colors hover:bg-ink-blue/90 disabled:opacity-60"
            >
              <LogIn size={16} />
              {isSubmitting ? t("signin.submitting") : t("signin.submit")}
            </button>
          </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleOtpSubmit(onOtpSubmit)}>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-soil mb-1">
                  {challenge.challengeName === "EMAIL_OTP" ? t("signin.otp.email") : challenge.challengeName === "SMS_MFA" ? t("signin.otp.sms") : t("signin.otp.authenticator")}
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  {...registerOtp("code")}
                  aria-invalid={!!otpErrors.code}
                  className="h-11 w-full rounded-md border border-graph-line px-3 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ink-blue sm:text-sm"
                />
                {otpErrors.code && <p className="mt-1 text-sm text-danger-500">{t("common.required")}</p>}
              </div>
              <button
                type="submit"
                disabled={otpSubmitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink-blue text-sm font-semibold text-white transition-colors hover:bg-ink-blue/90 disabled:opacity-60"
              >
                <LogIn size={16} />
                {otpSubmitting ? t("signin.otp.verifying") : t("signin.otp.verify")}
              </button>
              <button
                type="button"
                onClick={() => { setChallenge(null); setError("") }}
                className="h-11 w-full rounded-md border border-graph-line text-sm font-semibold text-ink-black transition-colors hover:bg-graph-paper"
              >
                {t("signin.otp.back")}
              </button>
            </form>
          )}

          <div className="mt-3 text-right">
            <Link href="/auth/signin" className="text-xs text-pencil hover:text-ink-black">
              {t("signin.forgotPassword")}
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => { window.location.href = "/api/auth/oauth/google?mode=signin" }}
              className="h-11 w-full rounded-md border border-graph-line text-sm font-semibold text-ink-black transition-colors hover:bg-graph-paper"
            >
              {t("signin.google")}
            </button>
            <button
              onClick={() => alert(t("signin.passkeyComingSoon"))}
              className="h-11 w-full rounded-md border border-graph-line text-sm font-semibold text-ink-black transition-colors hover:bg-graph-paper"
            >
              {t("signin.passkey")}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-pencil">
            {t("signin.noAccount")}{" "}
            <Link href="/auth/signup" className="inline-flex items-center gap-1 font-semibold text-ink-blue hover:underline">
              {t("signin.createAccount")}
              <ArrowRight size={12} />
            </Link>
          </p>
        </div>
        </main>
      </div>
    </div>
  )
}
