"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Building2, ChevronDown, ChevronRight, Loader2, Shield, User, Users, WifiOff } from "lucide-react"

import { useAuthStore } from "@/stores/authStore"
import {
  cacheOfflineRecordRoutes,
  createLocalDemoSandbox,
  hydrateDemoWorkspaceOffline,
  loadOfflineDemoSandbox,
  persistDemoSandbox,
  type DemoOfflineWorkspace,
} from "@/lib/demo/offline-demo-cache"
import { DEMO_ORGS, DEMO_SCENARIOS, DEMO_USERS, ORG_MEMBERSHIPS, type DemoOrgKey } from "@/types/auth"

const roleIcons = { field_worker: User, supervisor: Shield, org_admin: Users } as const

function routeForRole(role: string) {
  if (role === "field_worker") return "/field-worker/home"
  if (role === "supervisor") return "/supervisor/dashboard"
  return "/admin/dashboard"
}

export default function DemoPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const setAuthFromApi = useAuthStore((s) => s.setAuthFromApi)
  const [expandedOrgKey, setExpandedOrgKey] = useState<DemoOrgKey>("AHK")
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
    if (user) router.replace(routeForRole(user.role))
  }, [user, router])

  const usersByOrg = useMemo(() => {
    return DEMO_SCENARIOS.map((scenario) => ({
      ...scenario,
      org: DEMO_ORGS[scenario.orgKey],
      memberships: ORG_MEMBERSHIPS
        .filter((membership) => membership.orgKey === scenario.orgKey)
        .map((membership) => ({
          ...membership,
          user: DEMO_USERS.find((candidate) => candidate.id === membership.userId)!,
        }))
        .filter((membership) => membership.user),
    }))
  }, [])

  const handleLogin = async (email: string, demoOrgKey: DemoOrgKey) => {
    const key = `${email}-${demoOrgKey}`
    setLoadingKey(key)
    setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, demoOrgKey }),
      })
      if (!res.ok) throw new Error("demo_login_failed")
      const data = await res.json()
      setAuthFromApi(data.user, data.org, data.orgs)
      try {
        const offlineWorkspaces = data.demo?.offlineWorkspaces as DemoOfflineWorkspace[] | undefined
        await hydrateDemoWorkspaceOffline(data.user, offlineWorkspaces)
        await cacheOfflineRecordRoutes(offlineWorkspaces)
        if (data.demo?.expiresAt && data.demo?.offlineWorkspaces?.length && data.demo?.offlineAccounts?.length) {
          persistDemoSandbox({
            expiresAt: data.demo.expiresAt,
            workspaces: data.demo.offlineWorkspaces,
            accounts: data.demo.offlineAccounts,
          })
        }
      } catch {
        // Demo auth must still enter the app; the user can sync once the session is active.
      }
      router.push(routeForRole(data.user.role))
    } catch {
      const offlineSandbox = loadOfflineDemoSandbox() ?? createLocalDemoSandbox()
      persistDemoSandbox({
        expiresAt: offlineSandbox.expiresAt,
        workspaces: offlineSandbox.workspaces,
        accounts: offlineSandbox.accounts,
      })
      const offlineAccount = offlineSandbox?.accounts.find((account) => account.email === email && account.orgKey === demoOrgKey)
      if (!offlineSandbox || !offlineAccount) {
        setError(t("demo.loginFailed"))
        return
      }
      setAuthFromApi(offlineAccount.user, offlineAccount.org, offlineAccount.orgs)
      await hydrateDemoWorkspaceOffline(offlineAccount.user, offlineSandbox.workspaces)
      await cacheOfflineRecordRoutes(offlineSandbox.workspaces)
      router.push(routeForRole(offlineAccount.user.role))
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <div className="min-h-screen bg-kivu-paper flex flex-col items-center justify-center px-4 py-10">
      {loadingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 px-4 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-graph-line bg-white px-6 py-7 text-center shadow-xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-graph-paper text-ink-blue">
              <Loader2 size={26} className="animate-spin" aria-hidden="true" />
            </div>
            <p className="font-display text-xl font-semibold tracking-tight text-ink-black">
              {t("demo.creating")}
            </p>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-pencil">
              {t("demo.creatingBody")}
            </p>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-graph-paper">
              <div className="h-full w-1/2 animate-[pulse_1.3s_ease-in-out_infinite] rounded-full bg-ink-blue" />
            </div>
          </div>
        </div>
      )}
      <div className="w-full max-w-2xl">
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
        {error && (
          <div className="mb-3 rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {usersByOrg.map((scenario) => {
            const expanded = expandedOrgKey === scenario.orgKey
            return (
              <section key={scenario.orgKey} className="border border-grid-line rounded-md bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedOrgKey(scenario.orgKey)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-graph-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-blue"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded border border-grid-line bg-graph-paper text-lake-deep shrink-0">
                    <Building2 size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-black truncate">{scenario.org.name}</span>
                    <span className="block text-xs text-pencil truncate">{t(`demo.scenarios.${scenario.orgKey}.description`, scenario.description)}</span>
                  </span>
                  {expanded ? <ChevronDown size={16} className="text-pencil" /> : <ChevronRight size={16} className="text-pencil" />}
                </button>

                {expanded && (
                  <ul className="border-t border-grid-line divide-y divide-grid-line">
                    {scenario.memberships.map(({ user: demoUser, role }) => {
                      const Icon = roleIcons[role] || User
                      const loading = loadingKey === `${demoUser.email}-${scenario.orgKey}`
                      return (
                        <li key={`${scenario.orgKey}-${demoUser.email}`}>
                          <button
                            onClick={() => handleLogin(demoUser.email, scenario.orgKey)}
                            disabled={!ready || loadingKey !== null}
                            className="group w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left hover:bg-graph-paper focus-visible:outline-none focus-visible:bg-graph-paper focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink-blue transition-colors"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded border border-grid-line bg-graph-paper text-ink-blue shrink-0">
                              <Icon size={18} strokeWidth={2} />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-medium text-ink-black truncate">{loading ? t("demo.creating") : demoUser.name}</span>
                              <span className="block font-mono text-[11px] text-pencil truncate">{demoUser.email}</span>
                            </span>
                            <span className="inline-flex items-center rounded-[3px] border border-ink-blue px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-blue shrink-0">
                              {t(`roles.${role}`)}
                            </span>
                            <ChevronRight size={16} className="text-pencil/60 group-hover:text-ink-black shrink-0" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>

        <p className="mt-4 text-center text-[11px] text-pencil">
          {t("auth.demo_disclaimer")} &middot; v0.1
        </p>
      </div>
    </div>
  )
}
