"use client"

import { useTranslation } from "react-i18next"
import { useWorkflowStore } from "@/stores/workflowStore"

export function FormPreview() {
  const { t, i18n } = useTranslation()
  const { workflow } = useWorkflowStore()

  if (!workflow) return null

  const english = (i18n.resolvedLanguage || i18n.language)?.startsWith("en")
  const workflowName = english ? workflow.nameEn || workflow.name : workflow.name
  const fields = [...workflow.entity.fields].sort((a, b) => a.order - b.order)

  return (
    <div className="relative mx-auto w-[375px] h-[812px] rounded-[3rem] border-4 border-ink-black bg-white shadow-xl overflow-hidden">
      <div className="h-7 bg-graph-paper flex items-center justify-between px-6 text-[10px] text-pencil">
        <span>09:41</span>
        <span>📶 🔋</span>
      </div>

      <div className="px-5 py-4 border-b border-graph-line">
        <h2 className="font-sans text-base font-semibold text-ink-black">{workflowName}</h2>
      </div>

      <div className="p-5 space-y-4 overflow-y-auto h-[calc(100%-120px)]">
        {fields.length === 0 ? (
          <p className="text-sm text-pencil italic text-center py-12">
            {t("workflow.noFields", "Aucun champ. Ajoutez des champs dans l&apos;onglet Fields.")}
          </p>
        ) : (
          fields.map((field) => (
            <div key={field.id}>
              <label className="text-xs font-medium text-pencil mb-1 block">
                {english ? field.labelEn || field.label : field.label}
                {field.required && <span className="text-danger-500 ml-0.5">*</span>}
              </label>
              {field.type === "textarea" ? (
                <div className="h-20 rounded-md border border-graph-line bg-white px-3 py-2 text-sm text-pencil/60" />
              ) : field.type === "select" ? (
                <div className="h-10 rounded-md border border-graph-line bg-white px-3 py-2 text-sm text-pencil/60 flex items-center justify-between">
                  <span>{t("workflow.previews.select")}</span>
                  <span>▼</span>
                </div>
              ) : field.type === "date" ? (
                <div className="h-10 rounded-md border border-graph-line bg-white px-3 py-2 text-sm text-pencil/60 flex items-center justify-between">
                  <span>{t("workflow.previews.date")}</span>
                  <span>📅</span>
                </div>
              ) : field.type === "gps" ? (
                <div className="h-10 rounded-md border border-graph-line bg-white px-3 py-2 text-sm text-pencil/60 flex items-center gap-2">
                  <span>📍</span>
                  <span>{t("workflow.previews.gpsText")}</span>
                </div>
              ) : field.type === "photo" ? (
                <div className="h-24 rounded-md border border-dashed border-graph-line bg-kivu-paper flex items-center justify-center text-sm text-pencil/60">
                  📷 {t("workflow.previews.photoText")}
                </div>
              ) : (
                <div className="h-10 rounded-md border border-graph-line bg-white px-3 py-2 text-sm text-pencil/60" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
