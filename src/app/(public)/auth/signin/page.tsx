"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { LogIn } from "lucide-react"
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
        const data = await res.json()
        setError(data.error || "Erreur de connexion")
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
      setError("Erreur réseau")
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
        const data = await res.json()
        setError(data.error || "Code invalide")
        return
      }

      const data = await res.json()
      setAuthFromApi(data.user, data.org, data.orgs)
      router.push(data.user.role === "field_worker" ? "/field-worker/home" : data.user.role === "supervisor" ? "/supervisor/dashboard" : "/admin/dashboard")
    } catch {
      setError("Erreur réseau")
    }
  }

  return (
    <div className="min-h-screen bg-kivu-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-grid-line rounded-md p-8">
          <h1 className="font-display text-2xl font-bold text-lake-deep tracking-tight">
            {t("signin.title")}
          </h1>

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
                className="w-full h-10 px-3 rounded-md border border-graph-line text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
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
                className="w-full h-10 px-3 rounded-md border border-graph-line text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
              />
              {errors.password && <p className="mt-1 text-sm text-danger-500">{t("common.required")}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 rounded-md bg-ink-blue text-white font-medium text-sm hover:bg-ink-blue/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogIn size={16} />
              {isSubmitting ? "Connexion..." : t("signin.submit")}
            </button>
          </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleOtpSubmit(onOtpSubmit)}>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-soil mb-1">
                  {challenge.challengeName === "EMAIL_OTP" ? "Code email" : challenge.challengeName === "SMS_MFA" ? "Code SMS" : "Code authenticator"}
                </label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  {...registerOtp("code")}
                  aria-invalid={!!otpErrors.code}
                  className="w-full h-10 px-3 rounded-md border border-graph-line text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
                />
                {otpErrors.code && <p className="mt-1 text-sm text-danger-500">{t("common.required")}</p>}
              </div>
              <button
                type="submit"
                disabled={otpSubmitting}
                className="w-full h-10 rounded-md bg-ink-blue text-white font-medium text-sm hover:bg-ink-blue/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <LogIn size={16} />
                {otpSubmitting ? "Vérification..." : "Vérifier"}
              </button>
              <button
                type="button"
                onClick={() => { setChallenge(null); setError("") }}
                className="w-full h-10 rounded-md border border-graph-line text-sm font-medium text-ink-black hover:bg-graph-paper transition-colors"
              >
                Retour
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
              onClick={() => {
                const domain = "fieldflow-hackathon.auth.us-east-1.amazoncognito.com"
                const clientId = "7r60o7fnej4vitoksrp6e93n9g"
                const redirectUri = window.location.origin + "/auth/callback"
                window.location.href = `https://${domain}/oauth2/authorize?identity_provider=Google&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=CODE&client_id=${clientId}&scope=email+openid+profile`
              }}
              className="w-full h-10 rounded-md border border-graph-line text-sm font-medium text-ink-black hover:bg-graph-paper transition-colors"
            >
              {t("signin.google")}
            </button>
            <button
              onClick={() => alert("Passkey coming soon")}
              className="w-full h-10 rounded-md border border-graph-line text-sm font-medium text-ink-black hover:bg-graph-paper transition-colors"
            >
              {t("signin.passkey")}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-pencil">
            {t("signin.noAccount")}{" "}
            <Link href="/auth/signup" className="text-ink-blue hover:underline">
              {t("signin.createAccount")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
