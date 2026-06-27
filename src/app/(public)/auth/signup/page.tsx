"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { UserPlus } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuthStore } from "@/stores/authStore"
import { Select } from "@/components/ui/select"

const SECTORS = ["humanitaire", "sante", "agriculture", "education"] as const

const signUpSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  orgName: z.string().min(1),
  orgSector: z.enum(SECTORS),
})

type SignUpValues = z.infer<typeof signUpSchema>

export default function SignUpPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const setAuthFromApi = useAuthStore((s) => s.setAuthFromApi)
  const [error, setError] = useState("")
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", name: "", password: "", orgName: "", orgSector: "humanitaire" },
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
        const data = await res.json()
        setError(data.error || "Erreur d'inscription")
        return
      }

      const data = await res.json()
      if (data.user && data.org) setAuthFromApi(data.user, data.org, data.orgs)
      router.push(data.redirect || "/auth/signin")
    } catch {
      setError("Erreur réseau")
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
                className="w-full h-10 px-3 rounded-md border border-graph-line text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
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
                className="w-full h-10 px-3 rounded-md border border-graph-line text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
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
                className="w-full h-10 px-3 rounded-md border border-graph-line text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
              />
              {errors.password && <p className="mt-1 text-sm text-danger-500">{t("common.required")}</p>}
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
                className="w-full h-10 px-3 rounded-md border border-graph-line text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
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
              className="w-full h-10 rounded-md bg-ink-blue text-white font-medium text-sm hover:bg-ink-blue/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UserPlus size={16} />
              {isSubmitting ? "Inscription..." : t("signup.submit")}
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
