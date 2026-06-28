import type { WorkflowProposal } from "@/lib/ai/types"
import type { WorkflowDefinition } from "@/types/workflow"

export interface ValidationError {
  code: string
  message: string
  field?: string
  suggestion?: string
}

export function validateProposal(
  proposal: WorkflowProposal,
  snapshot: WorkflowDefinition
): ValidationError[] {
  const errors: ValidationError[] = []

  const existingFieldKeys = new Set(snapshot.entity.fields.map((f) => f.key))
  const existingStateKeys = new Set(snapshot.states.map((s) => s.key))
  const existingRoleKeys = new Set(snapshot.roles.map((r) => r.key))
  const allStateKeys = new Set([
    ...existingStateKeys,
    ...proposal.states.map((s) => s.state.key),
  ])

  // R1: Field keys unique against existing
  for (const pf of proposal.fields) {
    if (existingFieldKeys.has(pf.field.key)) {
      errors.push({
        code: "DUPLICATE_FIELD_KEY",
        message: `Field key "${pf.field.key}" already exists`,
        field: pf.field.key,
        suggestion: `Rename to "${pf.field.key}_2" or "${pf.field.key}_alt"`,
      })
    }
  }

  // R2: Field keys within proposal unique
  const proposedKeys = new Map<string, number>()
  for (const pf of proposal.fields) {
    proposedKeys.set(pf.field.key, (proposedKeys.get(pf.field.key) ?? 0) + 1)
  }
  for (const [key, count] of proposedKeys) {
    if (count > 1) {
      errors.push({
        code: "DUPLICATE_IN_PROPOSAL",
        message: `Field key "${key}" appears ${count} times in proposal`,
        field: key,
      })
    }
  }

  // R3: Field keys are valid identifiers
  const validKey = /^[a-z][a-z0-9_]*$/
  for (const pf of proposal.fields) {
    if (!validKey.test(pf.field.key)) {
      errors.push({
        code: "INVALID_FIELD_KEY",
        message: `Field key "${pf.field.key}" is not valid. Use lowercase letters and underscores.`,
        field: pf.field.key,
        suggestion: pf.field.key.replace(/[^a-z0-9_]/g, "_").toLowerCase(),
      })
    }
  }

  // R4: Field types valid
  const validTypes = ["text", "number", "select", "multi-select", "date", "gps", "photo", "textarea"]
  for (const pf of proposal.fields) {
    if (!validTypes.includes(pf.field.type)) {
      errors.push({
        code: "INVALID_FIELD_TYPE",
        message: `Field type "${pf.field.type}" is not valid. Valid: ${validTypes.join(", ")}`,
        field: pf.field.key,
      })
    }
  }

  // R5: Select/multi-select must have options
  for (const pf of proposal.fields) {
    if (
      (pf.field.type === "select" || pf.field.type === "multi-select") &&
      (!pf.field.options || pf.field.options.length === 0)
    ) {
      errors.push({
        code: "MISSING_OPTIONS",
        message: `Select field "${pf.field.key}" must have at least one option`,
        field: pf.field.key,
      })
    }
  }

  // R6: State keys unique against existing
  const proposedStateKeys = new Set<string>()
  for (const ps of proposal.states) {
    if (existingStateKeys.has(ps.state.key) || proposedStateKeys.has(ps.state.key)) {
      errors.push({
        code: "DUPLICATE_STATE_KEY",
        message: `State key "${ps.state.key}" already exists`,
        field: ps.state.key,
        suggestion: `Rename to "${ps.state.key}_2"`,
      })
    }
    proposedStateKeys.add(ps.state.key)
  }

  // R7: Transitions reference existing states
  for (const pt of proposal.transitions) {
    if (!allStateKeys.has(pt.transition.fromState)) {
      errors.push({
        code: "MISSING_FROM_STATE",
        message: `Transition "${pt.transition.key}" references state "${pt.transition.fromState}" which doesn't exist`,
        field: pt.transition.key,
      })
    }
    if (!allStateKeys.has(pt.transition.toState)) {
      errors.push({
        code: "MISSING_TO_STATE",
        message: `Transition "${pt.transition.key}" references state "${pt.transition.toState}" which doesn't exist`,
        field: pt.transition.key,
      })
    }
  }

  // R8: Transition keys unique
  const proposedTransKeys = new Set<string>()
  const existingTransKeys = new Set(snapshot.transitions.map((t) => t.key))
  for (const pt of proposal.transitions) {
    if (
      existingTransKeys.has(pt.transition.key) ||
      proposedTransKeys.has(pt.transition.key)
    ) {
      errors.push({
        code: "DUPLICATE_TRANSITION_KEY",
        message: `Transition key "${pt.transition.key}" already exists`,
        field: pt.transition.key,
      })
    }
    proposedTransKeys.add(pt.transition.key)
  }

  // R9: Role references exist
  for (const pt of proposal.transitions) {
    for (const role of pt.transition.requiredRoles) {
      if (!existingRoleKeys.has(role)) {
        errors.push({
          code: "UNKNOWN_ROLE",
          message: `Transition "${pt.transition.key}" references role "${role}" which doesn't exist. Valid: ${[...existingRoleKeys].join(", ")}`,
          field: pt.transition.key,
        })
      }
    }
  }

  // R10: At least one initial state exists (combined)
  const hasInitial =
    snapshot.states.some((s) => s.isInitial) ||
    proposal.states.some((s) => s.state.isInitial)
  if (!hasInitial) {
    errors.push({
      code: "NO_INITIAL_STATE",
      message: "No initial state exists. At least one state must be marked as initial.",
    })
  }

  // R11: Labels are present
  for (const pf of proposal.fields) {
    if (!pf.field.label.trim() && !pf.field.labelEn?.trim()) {
      errors.push({
        code: "MISSING_LABEL",
        message: `Field "${pf.field.key}" has no label`,
        field: pf.field.key,
      })
    }
  }
  for (const ps of proposal.states) {
    if (!ps.state.label.trim() && !ps.state.labelEn?.trim()) {
      errors.push({
        code: "MISSING_LABEL",
        message: `State "${ps.state.key}" has no label`,
        field: ps.state.key,
      })
    }
  }

  return errors
}

export function buildValidationFeedback(errors: ValidationError[]): string {
  const lines = [
    "=== VALIDATION FAILED ===",
    `The proposal has ${errors.length} error(s). Please fix them and call propose_changes again with the corrected proposal.`,
    "",
    ...errors.map(
      (e, i) =>
        `${i + 1}. [${e.code}] ${e.message}${e.suggestion ? `\n   SUGGESTION: ${e.suggestion}` : ""}`
    ),
    "",
    "IMPORTANT: Call propose_changes with the COMPLETE proposal (all fields, states, transitions), not just the fixes.",
    "Do NOT output raw JSON. Use the propose_changes tool.",
  ]
  return lines.join("\n")
}
