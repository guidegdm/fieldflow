"use client"

import { useTranslation } from "react-i18next"
import { useWorkflowStore } from "@/stores/workflowStore"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"

const FIELD_TYPES = [
  "text", "number", "select", "multi-select",
  "date", "gps", "photo", "textarea",
]

const TYPE_LABELS: Record<string, string> = {
  text: "workflow.fieldTypes.text",
  number: "workflow.fieldTypes.number",
  select: "workflow.fieldTypes.select",
  "multi-select": "workflow.fieldTypes.multiSelect",
  date: "workflow.fieldTypes.date",
  gps: "workflow.fieldTypes.gps",
  photo: "workflow.fieldTypes.photo",
  textarea: "workflow.fieldTypes.textarea",
}

export function FieldEditor() {
  const { t, i18n } = useTranslation()
  const { workflow, selectedFieldId, updateField, removeField } = useWorkflowStore()

  const field = workflow?.entity.fields.find((f) => f.id === selectedFieldId)
  const english = (i18n.resolvedLanguage || i18n.language)?.startsWith("en")

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

  const optionBase = field.options?.length ? field.options : [{ label: "Option 1", labelEn: "Option 1", value: "option_1" }]
  const isChoiceField = field.type === "select" || field.type === "multi-select"
  const normalizeValue = (label: string, fallback: string) => {
    const value = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
    return value || fallback
  }
  const makeUniqueValue = (value: string, index?: number) => {
    const existing = optionBase.map((option, optionIndex) => optionIndex === index ? "" : option.value)
    let candidate = value
    let suffix = 2
    while (existing.includes(candidate)) {
      candidate = `${value}_${suffix}`
      suffix += 1
    }
    return candidate
  }
  const updateOption = (index: number, updates: { label?: string; labelEn?: string; value?: string }) => {
    const options = optionBase.map((option, optionIndex) => {
      if (optionIndex !== index) return option
      const next = { ...option, ...updates }
      if (updates.label !== undefined && updates.value === undefined && !english) {
        next.value = makeUniqueValue(normalizeValue(updates.label, `option_${index + 1}`), index)
      }
      if (updates.labelEn !== undefined && updates.value === undefined && english) {
        next.value = makeUniqueValue(normalizeValue(updates.labelEn, `option_${index + 1}`), index)
      }
      if (updates.value !== undefined) {
        next.value = makeUniqueValue(normalizeValue(updates.value, `option_${index + 1}`), index)
      }
      return next
    })
    updateField(field.id, { options })
  }
  const addOption = () => {
    const nextNumber = optionBase.length + 1
    updateField(field.id, {
      options: [
        ...optionBase,
        {
          label: `Option ${nextNumber}`,
          labelEn: `Option ${nextNumber}`,
          value: makeUniqueValue(`option_${nextNumber}`),
        },
      ],
    })
  }
  const removeOption = (index: number) => {
    const options = optionBase.filter((_, optionIndex) => optionIndex !== index)
    updateField(field.id, { options: options.length ? options : [{ label: "Option 1", labelEn: "Option 1", value: "option_1" }] })
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
        value={english ? field.labelEn || field.label : field.label}
        onChange={(e) => updateField(field.id, english ? { labelEn: e.target.value } : { label: e.target.value })}
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
            if (type === "select" || type === "multi-select")
              updates.options = optionBase
            updateField(field.id, updates as Partial<typeof field>)
          }}
          className="h-10"
        >
          {FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type] ? t(TYPE_LABELS[type]) : type}
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

      {isChoiceField && (
        <div className="space-y-4 rounded-lg border border-graph-line bg-white p-4">
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-volcanic-ash">
              {t("workflow.choiceBehavior", "Choice behavior")}
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateField(field.id, { type: "select", options: optionBase })}
                className={`min-h-10 rounded-md border px-3 text-sm transition-colors ${
                  field.type === "select"
                    ? "border-ink-blue bg-ink-blue text-white"
                    : "border-graph-line bg-white text-pencil hover:border-ink-blue/40"
                }`}
              >
                {t("workflow.singleChoice", "Single choice")}
              </button>
              <button
                type="button"
                onClick={() => updateField(field.id, { type: "multi-select", options: optionBase })}
                className={`min-h-10 rounded-md border px-3 text-sm transition-colors ${
                  field.type === "multi-select"
                    ? "border-ink-blue bg-ink-blue text-white"
                    : "border-graph-line bg-white text-pencil hover:border-ink-blue/40"
                }`}
              >
                {t("workflow.multipleChoices", "Multiple choices")}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-volcanic-ash">
                {t("workflow.choiceOptions", "Options")}
              </h4>
              <button
                type="button"
                onClick={addOption}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-ink-blue/30 px-2.5 text-xs font-medium text-ink-blue transition-colors hover:bg-ink-blue/5"
              >
                <Plus size={14} />
                {t("workflow.addOption", "Add option")}
              </button>
            </div>
            {optionBase.map((option, index) => (
              <div key={`${option.value}-${index}`} className="grid gap-2 rounded-md border border-graph-line bg-slate-50 p-3">
                <div className="flex items-start gap-2">
                  <Input
                    label={t("workflow.optionLabel", "Label")}
                    value={english ? option.labelEn || option.label : option.label}
                    onChange={(event) => updateOption(index, english ? { labelEn: event.target.value } : { label: event.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="mt-6 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-pencil/50 transition-colors hover:bg-danger-500/10 hover:text-danger-500"
                    aria-label={t("workflow.removeOption", "Remove option")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <Input
                  label={t("workflow.optionValue", "Stored value")}
                  value={option.value}
                  onChange={(event) => updateOption(index, { value: event.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {field.type === "number" && (
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
      )}
    </div>
  )
}
