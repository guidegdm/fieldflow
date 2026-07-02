import type { TFunction } from "i18next"
import type { RecordData } from "@/types/record"
import type { WorkflowDefinition, WorkflowField } from "@/types/workflow"
import { hasAnyRoleAccess } from "@/lib/auth/roles"

export function workflowLabel(workflow: WorkflowDefinition | null | undefined, language?: string) {
  if (!workflow) return ""
  return language?.startsWith("en") ? workflow.nameEn || workflow.name : workflow.name || workflow.nameEn
}

export function fieldLabel(field: WorkflowField, language?: string) {
  return language?.startsWith("en") ? field.labelEn || field.label : field.label || field.labelEn
}

export function displayFieldKey(workflow: WorkflowDefinition | null | undefined) {
  if (!workflow) return "household_name"
  return (
    workflow.entity.displayField ||
    workflow.entity.fields.find((field) => field.required && field.type === "text")?.key ||
    workflow.entity.fields.find((field) => field.type === "text")?.key ||
    workflow.entity.fields[0]?.key ||
    "household_name"
  )
}

export function initialStateId(workflow: WorkflowDefinition | null | undefined) {
  return workflow?.states.find((state) => state.isInitial)?.id || workflow?.states[0]?.id || "s-draft"
}

export function submittedStateId(workflow: WorkflowDefinition | null | undefined, role = "field_worker") {
  const initial = initialStateId(workflow)
  const transition = workflow?.transitions.find((candidate) => {
    const key = `${candidate.key} ${candidate.label} ${candidate.labelEn}`.toLowerCase()
    return candidate.fromState === initial && key.includes("submit") && hasAnyRoleAccess(role, candidate.requiredRoles ?? [])
  }) || workflow?.transitions.find((candidate) =>
    candidate.fromState === initial && hasAnyRoleAccess(role, candidate.requiredRoles ?? [])
  )

  return transition?.toState || initial
}

export function formatFieldValue(value: unknown, field?: WorkflowField, t?: TFunction, language?: string) {
  if (value === undefined || value === null || value === "") return "-"
  if (Array.isArray(value)) {
    return value
      .map((item) => optionLabel(field, String(item), language) || String(item))
      .join(", ")
  }
  if (typeof value === "boolean") return value ? (t?.("common.yes", "Yes") ?? "Yes") : (t?.("common.no", "No") ?? "No")
  if (field?.type === "select") return optionLabel(field, String(value), language) || String(value)
  if (field?.type === "date") {
    const date = new Date(String(value))
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString()
  }
  return String(value)
}

function humanizeOptionValue(value: string) {
  const known: Record<string, string> = {
    tent: "Tent",
    temporary: "Temporary shelter",
    hosted: "Hosted",
    food: "Food",
    water: "Drinking water",
    shelter: "Shelter",
    medicine: "Medicine",
    good: "Good",
    damaged: "Damaged",
    expired: "Expired",
    health: "Health",
    protection: "Protection",
  }
  return known[value] || value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export function optionLabel(field: WorkflowField | undefined, value: string, language?: string) {
  const option = field?.options?.find((candidate) => candidate.value === value)
  if (!option) return undefined
  if (language?.startsWith("en")) return option.labelEn || humanizeOptionValue(option.value)
  return option.label || option.labelEn || humanizeOptionValue(option.value)
}

export function recordTitle(record: RecordData, workflow?: WorkflowDefinition | null) {
  const key = displayFieldKey(workflow)
  const value = record.fields?.[key] ?? record.fieldValues?.[key]
  return value ? String(value) : record.id.slice(0, 8)
}

export function recordSubtitle(record: RecordData, workflow?: WorkflowDefinition | null, language?: string) {
  const fields = workflow?.entity.fields ?? []
  const key = displayFieldKey(workflow)
  const parts = fields
    .filter((field) => field.key !== key)
    .slice(0, 2)
    .map((field) => formatFieldValue(record.fields?.[field.key] ?? record.fieldValues?.[field.key], field, undefined, language))
    .filter((value) => value && value !== "-")
  if (parts.length) return parts.join(" · ")
  const legacy = [record.fields?.household_size ? `${record.fields.household_size} pers.` : "", record.fields?.shelter_type]
    .filter(Boolean)
    .join(" · ")
  return legacy || workflowLabel(workflow, language) || record.workflowId
}

export function groupFieldsBySection(fields: WorkflowField[]) {
  const groups = new Map<string, WorkflowField[]>()
  for (const field of [...fields].sort((a, b) => a.order - b.order)) {
    const section = field.section || "details"
    groups.set(section, [...(groups.get(section) ?? []), field])
  }
  return Array.from(groups.entries()).map(([section, sectionFields]) => ({ section, fields: sectionFields }))
}

export function sectionLabel(section: string, language?: string) {
  const normalized = section.trim().toLowerCase()
  const labels: Record<string, { en: string; fr: string }> = {
    "identification": { en: "Identification", fr: "Identification" },
    "conditions de vie": { en: "Living conditions", fr: "Conditions de vie" },
    "living conditions": { en: "Living conditions", fr: "Conditions de vie" },
    "besoins": { en: "Priority needs", fr: "Besoins" },
    "priority needs": { en: "Priority needs", fr: "Besoins" },
    "needs": { en: "Priority needs", fr: "Besoins" },
    "stock": { en: "Stock", fr: "Stock" },
    "intake": { en: "Intake", fr: "Collecte" },
    "triage": { en: "Triage", fr: "Triage" },
    "details": { en: "Details", fr: "Details" },
  }
  const mapped = labels[normalized]
  if (mapped) return language?.startsWith("en") ? mapped.en : mapped.fr
  return section
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}
