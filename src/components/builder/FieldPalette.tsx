"use client"

import { useTranslation } from "react-i18next"
import { useWorkflowStore } from "@/stores/workflowStore"

const FIELD_TYPES = [
  { type: "text", icon: "Abc", labelKey: "workflow.fieldTypes.text" },
  { type: "number", icon: "123", labelKey: "workflow.fieldTypes.number" },
  { type: "select", icon: "≡", labelKey: "workflow.fieldTypes.select" },
  { type: "multi-select", icon: "☑", labelKey: "workflow.fieldTypes.multiSelect" },
  { type: "date", icon: "📅", labelKey: "workflow.fieldTypes.date" },
  { type: "gps", icon: "📍", labelKey: "workflow.fieldTypes.gps" },
  { type: "photo", icon: "📷", labelKey: "workflow.fieldTypes.photo" },
  { type: "textarea", icon: "📝", labelKey: "workflow.fieldTypes.textarea" },
]

export function FieldPalette({ onOpenAI }: { onOpenAI?: () => void }) {
  const { t } = useTranslation()
  const { workflow, addField, updateField } = useWorkflowStore()

  const handleAddField = (type: string) => {
    if (!workflow) return
    addField()
    const w = useWorkflowStore.getState().workflow
    if (!w) return
    const field = w.entity.fields[w.entity.fields.length - 1]
    const updates: Record<string, unknown> = { type }
    if (type === "select" || type === "multi-select") {
      updates.options = [{ label: "Option 1", value: "option_1" }]
    }
    updateField(field.id, updates as Partial<typeof field>)
    useWorkflowStore.setState({ selectedFieldId: field.id })
  }

  return (
    <div className="py-4">
      <h3 className="text-[11px] uppercase tracking-[0.15em] text-soil font-semibold mb-2 px-4">
        {t("workflow.fieldPalette", "Champs")}
      </h3>
      <div className="space-y-0.5">
        {FIELD_TYPES.map(({ type, icon, labelKey }) => (
          <button
            key={type}
            onClick={() => handleAddField(type)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-black hover:bg-kivu-paper transition-colors text-left"
          >
            <span className="w-6 text-center text-base">{icon}</span>
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </div>
      <div className="border-t border-graph-line my-3 mx-4" />
      <button
        onClick={onOpenAI}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-clay hover:text-clay/80 transition-colors"
      >
        <span className="w-6 text-center">✨</span>
        <span>{t("workflow.aiGenerateFields")}</span>
      </button>
    </div>
  )
}
