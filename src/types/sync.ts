export type OperationType = "create" | "update" | "delete" | "attach_evidence" | "workflow_definition"
export type MutationStatus = "PENDING" | "SENDING" | "ACKED" | "FAILED" | "CONFLICT" | "POISON"

export interface MutationEntry {
  client_id: string; device_id: string; operation: OperationType
  resource: string; workflow_id: string; record_id: string | null
  payload: unknown; client_timestamp: number; base_version: number
  base_fields?: Record<string, unknown>
  status: MutationStatus; retry_count: number; last_error: string | null; enqueued_at: number
  server_seq?: number
  poison_until?: number
}

export interface SyncBatchRequest { device_id: string; device_seq: number; operations: MutationEntry[] }

export interface ConflictEntry {
  client_id: string
  record_id: string
  field: string
  local_value: unknown
  server_value: unknown
  strategy: "last_write_wins" | "server_authoritative" | "manual" | "average" | "max" | "min" | "set_union" | "append_only"
  field_strategy: string
  auto_resolved: boolean
  resolved_value?: unknown
}

export interface SyncBatchResponse {
  acked: string[]; failed: { client_id: string; reason: string }[]
  conflicts: ConflictEntry[]
  server_changes: MutationEntry[]; last_seq: number; server_timestamp: number
}

export interface AuditEvent {
  id: string
  type: "conflict_auto_resolved" | "conflict_escalated" | "inventory_reservation" | "demo_sandbox_login"
  record_id?: string
  field?: string
  strategy?: string
  field_strategy?: string
  client_value?: unknown
  server_value?: unknown
  resolved_value?: unknown
  item_id?: string
  quantity?: number
  content_hash?: string
  status?: string
  install_id?: string
  user_id?: string
  org_id?: string
  selected_org_key?: string
  sandbox_created?: boolean
  workspace_count?: number
  workflow_count?: number
  record_count?: number
  conflict_count?: number
  inventory_item_count?: number
  demo_account_count?: number
  expiresAt?: number
  detail: string
  timestamp: number
}

export interface InventoryLedgerEntry {
  id: string
  contentHash: string
  itemId: string
  quantity: number
  userId: string | undefined
  stockBefore: { total: number; reserved: number }
  stockAfter: { total: number; reserved: number }
  status: "committed" | "failed_serialization"
  competingRequestId?: string
  idempotencyKey: string
  timestamp: number
}

export interface DeviceState {
  key: string; device_id: string; last_seq: number; last_sync_at: number | null
  pending_count: number; version: number; user_id: string; workflow_id: string; workflow_version: number
  orgId?: string
  expiresAt?: number
}

export interface ConflictRecord {
  id: string; workflow_id: string; record_id: string; field: string
  value_a: unknown; device_a: string; value_b: unknown; device_b: string
  status: "OPEN" | "RESOLVED"; resolved_by?: string; resolved_at?: number
  resolution?: "accept_a" | "accept_b" | "manual"; manual_value?: unknown; rationale?: string; created_at: number
}
