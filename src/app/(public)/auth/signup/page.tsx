"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { UserPlus } from "lucide-react"

const SECTORS = ["humanitaire", "sante", "agriculture", "education"] as const

export default function SignUpPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = e.currentTarget
    const email = (form.elements.namedItem("email") as HTMLInputElement).value
    const name = (form.elements.namedItem("name") as HTMLInputElement).value
    const password = (form.elements.namedItem("password") as HTMLInputElement).value
    const orgName = (form.elements.namedItem("orgName") as HTMLInputElement).value
    const orgSector = (form.elements.namedItem("orgSector") as HTMLSelectElement).value

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, name, password, orgName, orgSector }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Erreur d'inscription")
        return
      }

      const data = await res.json()
      router.push(data.redirect || "/auth/signin")
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
            {t("signup.title")}
          </h1>

          {error && (
            <div className="mt-4 rounded-md bg-danger-500/10 border border-danger-500/30 px-4 py-2 text-sm text-danger-500">
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-soil mb-1">
                {t("signup.email")}
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
              <label htmlFor="name" className="block text-sm font-medium text-soil mb-1">
                {t("signup.name")}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-soil mb-1">
                {t("signup.password")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
              />
            </div>

            <hr className="border-grid-line" />

            <div>
              <label htmlFor="orgName" className="block text-sm font-medium text-soil mb-1">
                {t("signup.orgName")}
              </label>
              <input
                id="orgName"
                name="orgName"
                type="text"
                required
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="orgSector" className="block text-sm font-medium text-soil mb-1">
                {t("signup.orgSector")}
              </label>
              <select
                id="orgSector"
                name="orgSector"
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent bg-white"
              >
                {SECTORS.map((sector) => (
                  <option key={sector} value={sector}>
                    {t(`signup.sectors.${sector}`)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-md bg-ink-blue text-white font-medium text-sm hover:bg-blue-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UserPlus size={16} />
              {loading ? "Inscription..." : t("signup.submit")}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-pencil">
            {t("signup.hasAccount")}{" "}
            <Link href="/auth/signin" className="text-ink-blue hover:underline">
              {t("signup.signin")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
