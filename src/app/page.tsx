'use client'

import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

import { useAuthStore } from "@/stores/authStore"
import { DEMO_USERS } from "@/types/auth"
import { User, Shield, Users } from "lucide-react"

const roleIcons = { field_worker: User, supervisor: Shield, org_admin: Users } as const

export default function LoginPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)

  if (user) {
    if (user.role === "field_worker") router.push("/field-worker/home")
    else if (user.role === "supervisor") router.push("/supervisor/dashboard")
    else router.push("/admin/dashboard")
  }

  const handleLogin = (email: string, role: string) => {
    useAuthStore.getState().login(email)
    if (role === "field_worker") router.push("/field-worker/home")
    else if (role === "supervisor") router.push("/supervisor/dashboard")
    else router.push("/admin/dashboard")
  }

  return (
    <div className="min-h-screen bg-kivu-paper flex flex-col items-center justify-center px-4 py-8">
      <h1 className="font-display text-4xl text-lake-deep font-bold tracking-tight mb-1">
        {t("app.title")}
      </h1>
      <p className="text-sm text-ink-black/60">{t("app.subtitle")}</p>
      <p className="text-xs text-ink-black/40 mb-6">{t("app.tagline")}</p>
      <p className="text-xs font-medium text-ink-black/60 uppercase tracking-wider mb-3">
        {t("auth.demo_accounts")}
      </p>
      <div className="w-full max-w-sm space-y-3">
        {DEMO_USERS.map((user) => {
          const Icon = roleIcons[user.role] || User
          return (
            <button
              key={user.email}
              onClick={() => handleLogin(user.email, user.role)}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-grid-line bg-white hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-graph-paper flex items-center justify-center text-ink-blue shrink-0">
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-black truncate">{user.name}</div>
                <div className="text-xs text-pencil truncate">{user.email}</div>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border rotate-[-2deg] text-ink-blue border-ink-blue shrink-0">
                {t(`roles.${user.role}`)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
