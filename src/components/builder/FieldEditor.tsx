"use client"

import { useTranslation } from "react-i18next"
import { useWorkflowStore } from "@/stores/workflowStore"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Trash2 } from "lucide-react"

const FIELD_TYPES = [
  "text", "number", "select", "multi-select",
  "date", "gps", "photo", "textarea",
]

const TYPE_LABELS: Record<string, string> = {
  text: "Texte court",
  number: "Nombre",
  select: "Liste déroulante",
  "multi-select": "Choix multiples",
  date: "Date",
  gps: "GPS",
  photo: "Photo",
  textarea: "Texte long",
}

export function FieldEditor() {
  const { t } = useTranslation()
  const { workflow, selectedFieldId, updateField, removeField } = useWorkflowStore()

  const field = workflow?.entity.fields.find((f) => f.id === selectedFieldId)

  if (!field) {
    return (
      <div className="p-6">
        <p className="text-sm text-pencil italic">
          {t("workflow.noFieldSelected", "Sélectionnez un champ pour éditer ses propriétés")}
        </p>
      </div>
    )
  }

  const updateValidation = (key: "min" | "max", value: string) => {
    const validation = { ...(field.validation ?? {}) }
    if (value === "") delete validation[key]
    else validation[key] = Number(value)
    updateField(field.id, { validation })
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] uppercase tracking-[0.15em] text-soil font-semibold">
          {t("workflow.fieldProperties", "Propriétés du champ")}
        </h3>
        <button
          onClick={() => {
            removeField(field.id)
          }}
          className="text-pencil/40 hover:text-danger-500 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <Input
        label={t("workflow.fieldLabel", "Label")}
        value={field.label}
        onChange={(e) => updateField(field.id, { label: e.target.value })}
      />

      <Input
        label={t("workflow.fieldKey", "Clé")}
        value={field.key}
        onChange={(e) => updateField(field.id, { key: e.target.value })}
        className="font-mono text-xs"
      />

      <div>
        <Select
          label={t("workflow.fieldType", "Type")}
          value={field.type}
          onChange={(e) => {
            const type = e.target.value
            const updates: Record<string, unknown> = { type }
            if ((type === "select" || type === "multi-select") && !field.options)
              updates.options = [{ label: "Option 1", value: "option_1" }]
            updateField(field.id, updates as Partial<typeof field>)
          }}
          className="h-10"
        >
          {FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type] ?? type}
            </option>
          ))}
        </Select>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer py-1">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => updateField(field.id, { required: e.target.checked })}
          className="h-4 w-4 rounded border-pencil text-ink-blue focus:ring-ink-blue"
        />
        <span className="text-sm text-ink-black">{t("workflow.required", "Obligatoire")}</span>
      </label>

      <div className="space-y-3">
        <h4 className="text-[11px] uppercase tracking-[0.1em] text-volcanic-ash font-medium">
          {t("workflow.validation", "Validation")}
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t("workflow.min", "Min")}
            type="number"
            value={field.validation?.min ?? ""}
            onChange={(e) => updateValidation("min", e.target.value)}
            placeholder="0"
          />
          <Input
            label={t("workflow.max", "Max")}
            type="number"
            value={field.validation?.max ?? ""}
            onChange={(e) => updateValidation("max", e.target.value)}
            placeholder="999"
          />
        </div>
      </div>
    </div>
  )
}
