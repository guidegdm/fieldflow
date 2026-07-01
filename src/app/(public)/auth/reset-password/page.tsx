"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ArrowLeft, KeyRound, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [step, setStep] = useState<"request" | "confirm">("request")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const [temporaryPasswordSent, setTemporaryPasswordSent] = useState(false)

  async function requestReset() {
    if (!email.trim()) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => null) as { error?: string; mode?: string } | null
      if (!res.ok) {
        throw new Error(data?.error || "request_failed")
      }
      setSent(true)
      if (data?.mode === "temporary_password") {
        setTemporaryPasswordSent(true)
        return
      }
      setTemporaryPasswordSent(false)
      setStep("confirm")
    } catch (err) {
      setError(err instanceof Error && err.message !== "request_failed" ? err.message : t("reset.errors.request"))
    } finally {
      setBusy(false)
    }
  }

  async function confirmReset() {
    if (!email.trim() || !code.trim() || password.length < 8) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), code: code.trim(), password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error || "reset_failed")
      }
      router.push(`/auth/signin?email=${encodeURIComponent(email.trim())}`)
    } catch (err) {
      setError(err instanceof Error && err.message !== "reset_failed" ? err.message : t("reset.errors.confirm"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC] px-4 py-8 sm:px-6 lg:px-8">
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md items-center">
        <div className="w-full rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
          <Link href="/auth/signin" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-pencil hover:text-ink-black">
            <ArrowLeft size={16} />
            {t("common.back")}
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-lake-deep">{t("reset.title")}</h1>
              <p className="mt-1 text-sm leading-6 text-pencil">
                {step === "request" ? t("reset.subtitle") : t("reset.confirmSubtitle")}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-blue/10 text-ink-blue">
              {step === "request" ? <KeyRound size={18} /> : <MailCheck size={18} />}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-danger-500/30 bg-danger-500/10 px-4 py-2 text-sm text-danger-500">
              {error}
            </div>
          )}

          {sent && (
            <div className="mt-4 rounded-md border border-antiseptic-green/30 bg-antiseptic-green/10 px-4 py-2 text-sm text-antiseptic-green">
              {temporaryPasswordSent ? t("reset.temporaryPasswordSent") : t("reset.sent")}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              label={t("signin.email")}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            {step === "confirm" && (
              <>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  label={t("reset.code")}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  label={t("reset.newPassword")}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </>
            )}

            {temporaryPasswordSent ? (
              <Button type="button" className="w-full" onClick={() => router.push(`/auth/signin?email=${encodeURIComponent(email.trim())}`)}>
                {t("reset.backToSignin")}
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full"
                loading={busy}
                disabled={step === "request" ? !email.trim() : !email.trim() || !code.trim() || password.length < 8}
                onClick={step === "request" ? requestReset : confirmReset}
              >
                {step === "request" ? t("reset.sendCode") : t("reset.savePassword")}
              </Button>
            )}

            {step === "confirm" && !temporaryPasswordSent && (
              <Button type="button" variant="ghost" className="w-full" onClick={requestReset} disabled={busy || !email.trim()}>
                {t("reset.resend")}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
