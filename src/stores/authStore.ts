import { create } from "zustand"
import { persist } from "zustand/middleware"
import { type DemoUser, type Org } from "@/types/auth"

interface AuthState {
  user: DemoUser | null
  org: Org | null
  orgs: Org[]
  /** True once the persisted state has been read from storage on the client. */
  hasHydrated: boolean
  login: (email: string, orgOverride?: Org) => boolean
  setAuthFromApi: (user: DemoUser, org: Org, orgs?: Org[]) => void
  switchOrg: (orgId: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      org: null,
      orgs: [],
      hasHydrated: false,
      login: () => false,
      setAuthFromApi: (user: DemoUser, org: Org, orgs?: Org[]) => set({ user, org, orgs: orgs?.length ? orgs : [org] }),
      switchOrg: (orgId: string) => set((state) => {
        const org = state.orgs.find((candidate) => candidate.id === orgId)
        if (!org) return state
        return { ...state, org, user: state.user ? { ...state.user, orgId: org.id } : state.user }
      }),
      logout: () => set({ user: null, org: null, orgs: [] }),
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
