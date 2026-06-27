"use client"

import { useTranslation } from "react-i18next"
import { useWorkflowStore } from "@/stores/workflowStore"

const FIELD_TYPES = [
  { type: "text", icon: "Abc", label: "Texte court" },
  { type: "number", icon: "123", label: "Nombre" },
  { type: "select", icon: "≡", label: "Liste déroulante" },
  { type: "multi-select", icon: "☑", label: "Choix multiples" },
  { type: "date", icon: "📅", label: "Date" },
  { type: "gps", icon: "📍", label: "GPS" },
  { type: "photo", icon: "📷", label: "Photo" },
  { type: "textarea", icon: "📝", label: "Texte long" },
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
        {FIELD_TYPES.map(({ type, icon, label }) => (
          <button
            key={type}
            onClick={() => handleAddField(type)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-black hover:bg-kivu-paper transition-colors text-left"
          >
            <span className="w-6 text-center text-base">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="border-t border-graph-line my-3 mx-4" />
      <button
        onClick={onOpenAI}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-clay hover:text-clay/80 transition-colors"
      >
        <span className="w-6 text-center">✨</span>
        <span>IA: Générer des champs...</span>
      </button>
    </div>
  )
}
