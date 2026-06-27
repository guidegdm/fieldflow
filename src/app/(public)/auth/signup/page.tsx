"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { UserPlus } from "lucide-react"

const SECTORS = ["humanitaire", "sante", "agriculture", "education"] as const

export default function SignUpPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-kivu-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-grid-line rounded-md p-8">
          <h1 className="font-display text-2xl font-bold text-lake-deep tracking-tight">
            {t("signup.title")}
          </h1>

          <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-soil mb-1">
                {t("signup.email")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-soil mb-1">
                {t("signup.name")}
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-soil mb-1">
                {t("signup.password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
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
                type="text"
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-ink-blue focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="orgSector" className="block text-sm font-medium text-soil mb-1">
                {t("signup.orgSector")}
              </label>
              <select
                id="orgSector"
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
              className="w-full h-10 rounded-md bg-ink-blue text-white font-medium text-sm hover:bg-blue-900 transition-colors flex items-center justify-center gap-2"
            >
              <UserPlus size={16} />
              {t("signup.submit")}
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
