export interface WorkflowDefinition {
  id: string
  orgId?: string
  version: number
  name: string
  nameEn: string
  description: string
  descriptionEn: string
  entity: WorkflowEntity
  states: WorkflowState[]
  transitions: WorkflowTransition[]
  roles: WorkflowRole[]
  offlinePolicy: OfflinePolicy
  status: "draft" | "published"
  createdAt: string
  updatedAt: string
  publishedAt?: string
  author: string
  expiresAt?: number
}

export interface WorkflowEntity {
  id: string
  key: string
  label: string
  labelEn: string
  displayField?: string
  fields: WorkflowField[]
}

export interface WorkflowField {
  id: string
  key: string
  label: string
  labelEn: string
  type: string
  required: boolean
  order: number
  section: string
  validation?: { min?: number; max?: number }
  options?: { label: string; labelEn?: string; value: string }[]
}

export type FieldDefinition = WorkflowField

export interface WorkflowState {
  id: string
  key: string
  label: string
  labelEn: string
  color: string
  isInitial: boolean
  isTerminal: boolean
  x: number
  y: number
}

export interface WorkflowTransition {
  id: string
  key: string
  label: string
  labelEn: string
  fromState: string
  toState: string
  requiredRoles: string[]
  sideEffects?: string[]
}

export interface WorkflowRole {
  id: string
  key: string
  label: string
  labelEn?: string
  permissions: string[]
}

export interface OfflinePolicy {
  maxOfflineHours: number
  allowedOperations: { create: boolean; update: boolean; delete: boolean; evidence: boolean }
  conflictStrategy: "last_write_wins" | "server_authoritative" | "manual"
  manualResolutionFields: string[]
  autoResolutionNumeric: "average" | "max" | "min"
  maxAttachmentSizeMb: number
  allowedAttachmentTypes: string[]
  attachmentSyncPriority: string
}
