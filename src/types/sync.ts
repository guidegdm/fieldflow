export type OperationType = "create" | "update" | "delete" | "attach_evidence"
export type MutationStatus = "PENDING" | "SENDING" | "ACKED" | "FAILED" | "CONFLICT"

export interface MutationEntry {
  client_id: string; device_id: string; operation: OperationType
  resource: string; workflow_id: string; record_id: string | null
  payload: unknown; client_timestamp: number; base_version: number
  status: MutationStatus; retry_count: number; last_error: string | null; enqueued_at: number
}

export interface SyncBatchRequest { device_id: string; device_seq: number; operations: MutationEntry[] }

export interface SyncBatchResponse {
  acked: string[]; failed: { client_id: string; reason: string }[]
  conflicts: { client_id: string; record_id: string; field: string; local_value: unknown; server_value: unknown }[]
  server_changes: MutationEntry[]; last_seq: number; server_timestamp: number
}

export interface DeviceState {
  key: string; device_id: string; last_seq: number; last_sync_at: number | null
  pending_count: number; version: number; user_id: string; workflow_id: string; workflow_version: number
}

export interface ConflictRecord {
  id: string; workflow_id: string; record_id: string; field: string
  value_a: unknown; device_a: string; value_b: unknown; device_b: string
  status: "OPEN" | "RESOLVED"; resolved_by?: string; resolved_at?: number
  resolution?: "accept_a" | "accept_b" | "manual"; manual_value?: unknown; rationale?: string; created_at: number
}
