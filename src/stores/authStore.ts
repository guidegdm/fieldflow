import { create } from "zustand"
import { persist } from "zustand/middleware"
import { DEMO_USERS, type DemoUser, type Org } from "@/types/auth"

interface AuthState {
  user: DemoUser | null
  org: Org | null
  /** True once the persisted state has been read from storage on the client. */
  hasHydrated: boolean
  login: (email: string, orgOverride?: Org) => boolean
  setAuthFromApi: (user: DemoUser, org: Org) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      org: null,
      hasHydrated: false,
      login: (email: string, orgOverride?: Org) => {
        const found = DEMO_USERS.find((u) => u.email === email)
        if (found) {
          const org = orgOverride || { id: found.orgId, name: "Organisation Démo" }
          set({ user: found, org })
        }
        return !!found
      },
      setAuthFromApi: (user: DemoUser, org: Org) => set({ user, org }),
      logout: () => set({ user: null, org: null }),
    }),
    {
      name: "fieldflow-auth",
      partialize: (state) => ({ user: state.user, org: state.org }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true
      },
    },
  ),
)
