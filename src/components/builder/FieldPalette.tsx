"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useWorkflowStore } from "@/stores/workflowStore"
import { useAgentStore } from "@/stores/agentStore"

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

export function FieldPalette() {
  const { t } = useTranslation()
  const { workflow, addField, updateField } = useWorkflowStore()
  const startGeneration = useAgentStore((s) => s.startGeneration)
  const [showAIPrompt, setShowAIPrompt] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")

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

  const handleGenerate = () => {
    if (!aiPrompt.trim() || !workflow) return
    startGeneration(aiPrompt, workflow)
    setAiPrompt("")
    setShowAIPrompt(false)
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
      {showAIPrompt ? (
        <div className="px-4 py-2 space-y-2">
          <textarea
            autoFocus
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={t("admin.aiPrompt", "Décrivez le workflow que vous souhaitez créer...")}
            className="w-full h-20 text-xs rounded border border-graph-line px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-clay"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleGenerate()
              }
            }}
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleGenerate}
              disabled={!aiPrompt.trim()}
              className="flex-1 py-1.5 text-xs bg-clay text-white rounded hover:bg-clay/90 disabled:opacity-50 transition-colors"
            >
              {t("admin.generate", "Générer")}
            </button>
            <button
              onClick={() => setShowAIPrompt(false)}
              className="py-1.5 px-2 text-xs text-pencil hover:text-ink-black transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAIPrompt(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-clay hover:text-clay/80 transition-colors"
        >
          <span className="w-6 text-center">✨</span>
          <span>{t("workflow.aiGenerateFields")}</span>
        </button>
      )}
    </div>
  )
}
