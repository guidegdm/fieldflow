"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useWorkflowStore } from "@/stores/workflowStore"
import { GripVertical, Plus, X } from "lucide-react"
import type { WorkflowField } from "@/types/workflow"

const FIELD_PREVIEWS: Record<string, string> = {
  text: "workflow.previews.text",
  number: "workflow.previews.number",
  select: "workflow.previews.select",
  "multi-select": "workflow.previews.multiSelect",
  date: "workflow.previews.date",
  gps: "workflow.previews.gps",
  photo: "workflow.previews.photo",
  textarea: "workflow.previews.textarea",
}

function reorder(arr: WorkflowField[], from: number, to: number) {
  const copy = [...arr]
  const [moved] = copy.splice(from, 1)
  copy.splice(to, 0, moved)
  return copy
}

export function FormCanvas() {
  const { t, i18n } = useTranslation()
  const { workflow, selectedFieldId, addField, updateField, removeField, updateWorkflow } =
    useWorkflowStore()
  const [dragSource, setDragSource] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [titleEditing, setTitleEditing] = useState(false)

  if (!workflow) return null

  const english = (i18n.resolvedLanguage || i18n.language)?.startsWith("en")
  const workflowName = english ? workflow.nameEn || workflow.name : workflow.name
  const fields = workflow.entity.fields
  const sortedFields = [...fields].sort((a, b) => a.order - b.order)
  const displayFields =
    dragSource !== null && dragOver !== null && dragSource !== dragOver
      ? reorder(sortedFields, dragSource, dragOver)
      : sortedFields

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = "move"
    setDragSource(index)
    setDragOver(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOver(index)
  }

  const handleDragEnd = () => {
    if (dragSource !== null && dragOver !== null && dragSource !== dragOver) {
      const reordered = [...sortedFields]
      const [moved] = reordered.splice(dragSource, 1)
      reordered.splice(dragOver, 0, moved)
      for (const f of reordered) updateField(f.id, { order: reordered.indexOf(f) })
    }
    setDragSource(null)
    setDragOver(null)
  }

  const isCurrentlyDragged = (index: number) =>
    dragSource !== null && dragOver !== null && index === dragSource && dragSource !== dragOver

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        {titleEditing ? (
          <input
            autoFocus
            defaultValue={workflowName}
            onBlur={(e) => {
              if (e.target.value.trim()) updateWorkflow(english ? { nameEn: e.target.value } : { name: e.target.value })
              setTitleEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if ((e.target as HTMLInputElement).value.trim())
                  updateWorkflow(english ? { nameEn: (e.target as HTMLInputElement).value } : { name: (e.target as HTMLInputElement).value })
                setTitleEditing(false)
              }
              if (e.key === "Escape") setTitleEditing(false)
            }}
            className="font-display text-2xl text-lake-deep tracking-tight bg-transparent border-b-2 border-clay/30 outline-none w-full pb-1"
          />
        ) : (
          <h1
            onClick={() => setTitleEditing(true)}
            className="font-display text-2xl text-lake-deep tracking-tight cursor-pointer hover:text-clay transition-colors"
          >
            {workflowName}
          </h1>
        )}
      </div>

      {displayFields.length === 0 && (
        <div className="text-center py-16 text-pencil">
          <p className="text-sm mb-2">{t("workflow.noFields", "Aucun champ")}</p>
          <p className="text-xs text-pencil/60">
            {t("workflow.clickPalette", "Cliquez sur un type de champ dans la palette à gauche")}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {displayFields.map((field, index) => (
          <div
            key={field.id}
            onClick={() => useWorkflowStore.setState({ selectedFieldId: field.id })}
            className={`relative rounded-md border-2 transition-all cursor-pointer bg-white ${
              selectedFieldId === field.id
                ? "border-lake-deep shadow-sm ring-1 ring-lake-deep/20"
                : "border-graph-line hover:border-lake-deep/30"
            } ${isCurrentlyDragged(index) ? "opacity-60 shadow-lg scale-[1.02] z-10" : ""}`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
          >
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="cursor-grab active:cursor-grabbing text-pencil/40 hover:text-pencil transition-colors"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <GripVertical size={16} />
                </span>
                <span className="text-sm font-medium text-ink-black">{english ? field.labelEn || field.label : field.label}</span>
                {field.required && <span className="text-danger-500 text-sm font-medium">*</span>}
                <span className="text-[10px] uppercase tracking-wider text-volcanic-ash ml-1">
                  {field.type}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeField(field.id)
                  }}
                  className="ml-auto text-pencil/40 hover:text-danger-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="ml-6 text-sm text-pencil/60 bg-kivu-paper rounded-sm px-3 py-2 border border-graph-line/50">
                {FIELD_PREVIEWS[field.type] ? t(FIELD_PREVIEWS[field.type]) : field.type}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          addField()
          const w = useWorkflowStore.getState().workflow
          if (!w) return
          const field = w.entity.fields[w.entity.fields.length - 1]
          useWorkflowStore.setState({ selectedFieldId: field.id })
        }}
        className="mt-3 w-full py-3 text-sm text-clay hover:text-clay/80 transition-colors flex items-center justify-center gap-1.5 border-2 border-dashed border-graph-line rounded-md hover:border-clay/30"
      >
        <Plus size={16} /> {t("workflow.addField", "Ajouter un champ")}
      </button>
    </div>
  )
}
