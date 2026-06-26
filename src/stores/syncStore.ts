import { create } from "zustand"
import type { ConflictRecord } from "@/types/sync"

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: number | null
  conflicts: ConflictRecord[]
  setOnline: (v: boolean) => void
  setSyncing: (v: boolean) => void
  setPendingCount: (v: number) => void
  setLastSync: (v: number) => void
  setConflicts: (v: ConflictRecord[]) => void
}

export const useSyncStore = create<SyncState>()((set) => ({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  conflicts: [],
  setOnline: (v) => set({ isOnline: v }),
  setSyncing: (v) => set({ isSyncing: v }),
  setPendingCount: (v) => set({ pendingCount: v }),
  setLastSync: (v) => set({ lastSyncAt: v }),
  setConflicts: (v) => set({ conflicts: v }),
}))
