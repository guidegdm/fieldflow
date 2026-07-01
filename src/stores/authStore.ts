import { create } from "zustand"
import { persist } from "zustand/middleware"
import { type DemoUser, type Org } from "@/types/auth"

interface AuthState {
  user: DemoUser | null
  org: Org | null
  orgs: Org[]
  orgSwitching: boolean
  sessionVerifiedAt: number
  /** True once the persisted state has been read from storage on the client. */
  hasHydrated: boolean
  login: (email: string, orgOverride?: Org) => boolean
  setAuthFromApi: (user: DemoUser, org: Org, orgs?: Org[]) => void
  setOrgSwitching: (switching: boolean) => void
  addLocalWorkspace: (org: Org) => void
  markWorkspaceSynced: (org: Org) => void
  switchOrg: (orgId: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      org: null,
      orgs: [],
      orgSwitching: false,
      sessionVerifiedAt: 0,
      hasHydrated: false,
      login: () => false,
      setAuthFromApi: (user: DemoUser, org: Org, orgs?: Org[]) => set(() => {
        const nextOrgs = orgs?.length ? orgs : [org]
        const activeOrg = nextOrgs.find((candidate) => candidate.id === org.id) ?? org
        const activeRole = activeOrg.role ?? user.role
        return {
          user: { ...user, orgId: activeOrg.id, role: activeRole },
          org: { ...activeOrg, role: activeRole },
          orgs: nextOrgs,
          sessionVerifiedAt: Date.now(),
        }
      }),
      setOrgSwitching: (switching: boolean) => set({ orgSwitching: switching }),
      addLocalWorkspace: (org: Org) => set((state) => {
        if (!state.user) return state
        const workspace = { ...org, role: "org_admin" as const, localOnly: org.localOnly ?? true }
        const orgs = [...state.orgs.filter((candidate) => candidate.id !== workspace.id), workspace]
        return {
          ...state,
          org: workspace,
          orgs,
          user: { ...state.user, orgId: workspace.id, role: "org_admin" },
        }
      }),
      markWorkspaceSynced: (org: Org) => set((state) => {
        const synced = { ...org, localOnly: false, role: org.role ?? "org_admin" as const }
        return {
          ...state,
          org: state.org?.id === synced.id ? synced : state.org,
          orgs: state.orgs.map((candidate) => candidate.id === synced.id ? synced : candidate),
          user: state.user && state.user.orgId === synced.id ? { ...state.user, role: synced.role ?? state.user.role } : state.user,
        }
      }),
      switchOrg: (orgId: string) => set((state) => {
        const org = state.orgs.find((candidate) => candidate.id === orgId)
        if (!org) return state
        const activeRole = org.role ?? state.user?.role
        return {
          ...state,
          org: activeRole ? { ...org, role: activeRole } : org,
          user: state.user && activeRole ? { ...state.user, orgId: org.id, role: activeRole } : state.user,
        }
      }),
      logout: () => set({ user: null, org: null, orgs: [], orgSwitching: false, sessionVerifiedAt: 0 }),
    }),
    {
      name: "fieldflow-auth",
      partialize: (state) => ({ user: state.user, org: state.org, orgs: state.orgs }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true
      },
    },
  ),
)
