export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  fields: WorkflowField[]
  version: number
  createdAt: number
  updatedAt: number
}

export interface WorkflowField {
  name: string
  label: string
  type: "text" | "number" | "select" | "date" | "signature"
  required: boolean
  options?: string[]
}
