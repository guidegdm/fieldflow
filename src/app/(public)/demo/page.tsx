'use client'

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"

import { useAuthStore } from "@/stores/authStore"
import { DEMO_USERS } from "@/types/auth"
import { User, Shield, Users, ChevronRight, WifiOff } from "lucide-react"

const roleIcons = { field_worker: User, supervisor: Shield, org_admin: Users } as const

function routeForRole(role: string) {
  if (role === "field_worker") return "/org/demo-org/field-worker/home"
  if (role === "supervisor") return "/org/demo-org/supervisor/dashboard"
  return "/org/demo-org/admin/dashboard"
}

export default function DemoPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user) router.replace(routeForRole(user.role))
  }, [user, router])

  const handleLogin = (email: string, role: string) => {
    useAuthStore.getState().login(email)
    router.push(routeForRole(role))
  }

  return (
    <div className="min-h-screen bg-kivu-paper flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <header className="border-b-2 border-ink-black pb-4 mb-6">
          <h1 className="font-display text-4xl text-lake-deep font-bold tracking-tight leading-none">
            {t("app.title")}
          </h1>
          <p className="mt-2 text-sm text-ink-black/70">{t("app.subtitle")}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-pencil">
            <WifiOff size={12} className="shrink-0" />
            {t("app.tagline")}
          </p>
        </header>

        <p className="text-[11px] font-semibold text-pencil uppercase tracking-[0.12em] mb-2">
          {t("auth.demo_accounts")}
        </p>

        <ul className="border border-grid-line rounded-md bg-white divide-y divide-grid-line overflow-hidden">
          {DEMO_USERS.map((u) => {
            const Icon = roleIcons[u.role] || User
            return (
              <li key={u.email}>
                <button
                  onClick={() => handleLogin(u.email, u.role)}
                  className="group w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left hover:bg-graph-paper focus-visible:outline-none focus-visible:bg-graph-paper focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-blue transition-colors"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded border border-grid-line bg-graph-paper text-ink-blue shrink-0">
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-ink-black truncate">{u.name}</span>
                    <span className="block font-mono text-[11px] text-pencil truncate">{u.email}</span>
                  </span>
                  <span className="inline-flex items-center rounded-[3px] border border-ink-blue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-blue shrink-0">
                    {t(`roles.${u.role}`)}
                  </span>
                  <ChevronRight size={16} className="text-pencil/60 group-hover:text-ink-black shrink-0" />
                </button>
              </li>
            )
          })}
        </ul>

        <p className="mt-4 text-center text-[11px] text-pencil">
          {t("auth.demo_disclaimer")} &middot; v0.1
        </p>
      </div>
    </div>
  )
}
