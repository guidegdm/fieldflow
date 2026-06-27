import { create } from "zustand"
import { persist } from "zustand/middleware"
import { DEMO_USERS, type DemoUser } from "@/types/auth"

interface AuthState {
  user: DemoUser | null
  /** True once the persisted state has been read from storage on the client. */
  hasHydrated: boolean
  login: (email: string) => boolean
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hasHydrated: false,
      login: (email: string) => {
        const found = DEMO_USERS.find((u) => u.email === email)
        if (found) set({ user: found })
        return !!found
      },
      logout: () => set({ user: null }),
    }),
    {
      name: "fieldflow-auth",
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true
      },
    },
  ),
)
