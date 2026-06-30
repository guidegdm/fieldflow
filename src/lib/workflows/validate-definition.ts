import type { WorkflowDefinition } from "@/types/workflow"

export type WorkflowValidationError = {
  code: string
  message: string
  field?: string
}

const VALID_FIELD_TYPES = new Set(["text", "number", "select", "multi_select", "multi-select", "date", "gps", "photo", "textarea"])
const VALID_ROLES = new Set(["field_worker", "supervisor", "org_admin"])

function duplicateValues(values: string[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return Array.from(duplicates)
}

export function validateWorkflowDefinition(workflow: WorkflowDefinition): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = []

  if (!workflow.id) errors.push({ code: "MISSING_ID", message: "Workflow id is required" })
  if (!workflow.name?.trim() && !workflow.nameEn?.trim()) errors.push({ code: "MISSING_NAME", message: "Workflow name is required" })
  if (!workflow.entity?.key) errors.push({ code: "MISSING_ENTITY", message: "Workflow entity key is required" })

  const fields = workflow.entity?.fields ?? []
  const states = workflow.states ?? []
  const transitions = workflow.transitions ?? []
  const roles = workflow.roles ?? []

  for (const key of duplicateValues(fields.map((field) => field.key).filter(Boolean))) {
    errors.push({ code: "DUPLICATE_FIELD_KEY", message: `Duplicate field key: ${key}`, field: key })
  }
  for (const field of fields) {
    if (!field.key) errors.push({ code: "MISSING_FIELD_KEY", message: "Field key is required", field: field.id })
    if (!field.label?.trim() && !field.labelEn?.trim()) errors.push({ code: "MISSING_FIELD_LABEL", message: `Field ${field.key || field.id} needs a label`, field: field.key || field.id })
    if (!VALID_FIELD_TYPES.has(field.type)) errors.push({ code: "INVALID_FIELD_TYPE", message: `Unsupported field type: ${field.type}`, field: field.key })
    if ((field.type === "select" || field.type === "multi_select" || field.type === "multi-select") && !field.options?.length) {
      errors.push({ code: "MISSING_FIELD_OPTIONS", message: `Choice field ${field.key} needs options`, field: field.key })
    }
  }

  if (states.length === 0) errors.push({ code: "NO_STATES", message: "At least one state is required" })
  const initialStates = states.filter((state) => state.isInitial)
  if (initialStates.length !== 1) errors.push({ code: "INVALID_INITIAL_STATE", message: "Exactly one initial state is required" })
  for (const key of duplicateValues(states.map((state) => state.key).filter(Boolean))) {
    errors.push({ code: "DUPLICATE_STATE_KEY", message: `Duplicate state key: ${key}`, field: key })
  }

  const stateIds = new Set(states.map((state) => state.id))
  const roleKeys = new Set([...roles.map((role) => role.key), ...VALID_ROLES])
  for (const transition of transitions) {
    if (!stateIds.has(transition.fromState)) errors.push({ code: "UNKNOWN_FROM_STATE", message: `Transition ${transition.key} references an unknown source state`, field: transition.key })
    if (!stateIds.has(transition.toState)) errors.push({ code: "UNKNOWN_TO_STATE", message: `Transition ${transition.key} references an unknown target state`, field: transition.key })
    for (const role of transition.requiredRoles ?? []) {
      if (!roleKeys.has(role)) errors.push({ code: "UNKNOWN_ROLE", message: `Transition ${transition.key} references unknown role ${role}`, field: transition.key })
    }
  }

  if (!workflow.offlinePolicy) errors.push({ code: "MISSING_OFFLINE_POLICY", message: "Offline policy is required" })
  if (workflow.offlinePolicy?.maxOfflineHours !== undefined && workflow.offlinePolicy.maxOfflineHours < 1) {
    errors.push({ code: "INVALID_OFFLINE_WINDOW", message: "Offline window must be at least one hour" })
  }

  return errors
}

export function workflowValidationResponse(errors: WorkflowValidationError[]) {
  return { error: "WORKFLOW_VALIDATION_FAILED", errors }
}
