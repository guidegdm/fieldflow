export interface RecordData {
  id: string
  workflowId: string
  deviceId: string
  operator: string
  fieldValues: Record<string, unknown>
  status: "pending" | "in_progress" | "completed" | "conflict"
  createdAt: number
  updatedAt: number
}
