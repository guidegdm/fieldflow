"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { LogIn } from "lucide-react"
import { useAuthStore } from "@/stores/authStore"

export default function SignInPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const setAuthFromApi = useAuthStore((s) => s.setAuthFromApi)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = e.currentTarget
    const email = (form.elements.namedItem("email") as HTMLInputElement).value
    const password = (form.elements.namedItem("password") as HTMLInputElement).value

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
      setAuthFromApi(data.user, data.org)
      router.push(data.user.role === "field_worker" ? "/field-worker/home" : "/supervisor/dashboard")
    } catch {
      setError("Erreur réseau")
    } finally {
      setLoading(false)
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

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-soil mb-1">
                {t("signin.email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-soil mb-1">
                {t("signin.password")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-ink-blue text-white font-medium text-sm hover:bg-blue-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogIn size={16} />
              {loading ? "Connexion..." : t("signin.submit")}
            </button>
          </form>

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
              className="w-full h-10 rounded-md border border-gray-300 text-sm font-medium text-ink-black hover:bg-gray-50 transition-colors"
            >
              {t("signin.google")}
            </button>
            <button
              onClick={() => alert("Passkey coming soon")}
              className="w-full h-10 rounded-md border border-gray-300 text-sm font-medium text-ink-black hover:bg-gray-50 transition-colors"
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
