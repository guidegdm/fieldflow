import type { TFunction } from "i18next"
import type { RecordData } from "@/types/record"
import type { WorkflowDefinition, WorkflowField } from "@/types/workflow"

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

export function formatFieldValue(value: unknown, field?: WorkflowField, t?: TFunction) {
  if (value === undefined || value === null || value === "") return "-"
  if (Array.isArray(value)) {
    return value
      .map((item) => optionLabel(field, String(item)) || String(item))
      .join(", ")
  }
  if (typeof value === "boolean") return value ? (t?.("common.yes", "Yes") ?? "Yes") : (t?.("common.no", "No") ?? "No")
  if (field?.type === "select") return optionLabel(field, String(value)) || String(value)
  if (field?.type === "date") {
    const date = new Date(String(value))
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString()
  }
  return String(value)
}

export function optionLabel(field: WorkflowField | undefined, value: string) {
  return field?.options?.find((option) => option.value === value)?.label
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
    .map((field) => formatFieldValue(record.fields?.[field.key] ?? record.fieldValues?.[field.key], field))
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

export function sectionLabel(section: string) {
  return section
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase())
}
