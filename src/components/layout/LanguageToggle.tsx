"use client"

import { useTranslation } from "react-i18next"
import { Check, Languages } from "lucide-react"
import { setAppLanguage, type AppLanguage } from "@/lib/i18n/i18n"
import { cn } from "@/lib/utils"

export function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const current: AppLanguage = i18n.resolvedLanguage?.startsWith("en") || i18n.language?.startsWith("en") ? "en" : "fr"

  const change = (next: AppLanguage) => {
    if (next === current) return
    void setAppLanguage(next)
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-md border border-graph-line bg-white p-1 shadow-sm"
      role="group"
      aria-label={t("language.select", "Language")}
    >
      <Languages size={14} className="mx-1 hidden text-pencil sm:block" aria-hidden="true" />
      {(["fr", "en"] as AppLanguage[]).map((language) => {
        const active = current === language
        return (
          <button
            key={language}
            type="button"
            onClick={() => change(language)}
            aria-pressed={active}
            className={cn(
              "inline-flex h-8 min-w-10 items-center justify-center gap-1 rounded px-2 text-xs font-semibold transition-colors",
              active ? "bg-ink-blue text-white" : "text-pencil hover:bg-graph-paper hover:text-ink-black",
            )}
          >
            {active && <Check size={12} aria-hidden="true" />}
            {language.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}
