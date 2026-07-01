"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { setAppLanguage, type AppLanguage } from "@/lib/i18n/i18n"
import { cn } from "@/lib/utils"

const LANGUAGES: Array<{ value: AppLanguage; label: string }> = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
]

function currentLanguage(language?: string): AppLanguage {
  return language?.startsWith("en") ? "en" : "fr"
}

export function LanguagePreferenceSelect({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState<AppLanguage>(() => currentLanguage(i18n.resolvedLanguage || i18n.language))

  useEffect(() => {
    const sync = () => setLanguage(currentLanguage(i18n.resolvedLanguage || i18n.language))
    sync()
    i18n.on("languageChanged", sync)
    return () => {
      i18n.off("languageChanged", sync)
    }
  }, [i18n])

  const changeLanguage = async (next: AppLanguage) => {
    setLanguage(next)
    await setAppLanguage(next)
  }

  return (
    <label className={cn("block", compact ? "space-y-1.5" : "space-y-2")}>
      <span className={cn("block font-medium text-pencil", compact ? "text-xs" : "text-sm")}>
        {t("language.preference", "Language")}
      </span>
      <select
        value={language}
        onChange={(event) => void changeLanguage(event.target.value as AppLanguage)}
        className={cn(
          "w-full rounded-md border border-graph-line bg-white text-ink-black outline-none transition-colors focus:border-ink-blue focus:ring-2 focus:ring-ink-blue/15",
          compact ? "h-9 px-2 text-xs" : "h-11 px-3 text-sm",
        )}
      >
        {LANGUAGES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}
