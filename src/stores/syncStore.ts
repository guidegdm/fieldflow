import { create } from "zustand"
import type { ConflictRecord } from "@/types/sync"

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: number | null
  lastAttemptAt: number | null
  lastSuccessfulSyncAt: number | null
  lastError: string | null
  conflicts: ConflictRecord[]
  setOnline: (v: boolean) => void
  setSyncing: (v: boolean) => void
  setPendingCount: (v: number) => void
  setLastSync: (v: number) => void
  setSyncAttempt: (v: number) => void
  setSyncSuccess: (v: number) => void
  setSyncError: (v: string | null) => void
  setConflicts: (v: ConflictRecord[]) => void
}

export const useSyncStore = create<SyncState>()((set) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastAttemptAt: null,
  lastSuccessfulSyncAt: null,
  lastError: null,
  conflicts: [],
  setOnline: (v) => set({ isOnline: v }),
  setSyncing: (v) => set({ isSyncing: v }),
  setPendingCount: (v) => set({ pendingCount: v }),
  setLastSync: (v) => set({ lastSyncAt: v, lastSuccessfulSyncAt: v, lastError: null }),
  setSyncAttempt: (v) => set({ lastAttemptAt: v }),
  setSyncSuccess: (v) => set({ lastSyncAt: v, lastSuccessfulSyncAt: v, lastError: null }),
  setSyncError: (v) => set({ lastError: v }),
  setConflicts: (v) => set({ conflicts: v }),
}))
