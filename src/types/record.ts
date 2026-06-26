export type SyncStatus = "local" | "pending" | "synced" | "conflict" | "failed"
export type RecordStatus = "pending" | "in_progress" | "completed" | "conflict"

export interface RecordData {
  id: string
  workflowId: string
  workflowVersion: number
  entityKey: string
  deviceId: string
  operator?: string
  status: string
  syncStatus: string
  state?: string
  fields: Record<string, unknown>
  fieldValues?: Record<string, unknown>
  version: number
  createdAt: number
  updatedAt: number
  syncedAt?: number
  createdBy?: string
}
