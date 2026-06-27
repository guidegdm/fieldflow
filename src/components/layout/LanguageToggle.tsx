"use client"

import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

export function LanguageToggle() {
  const { i18n } = useTranslation()
  const current = i18n.language?.startsWith("fr") ? "FR" : "EN"

  const toggle = () => {
    const next = current === "FR" ? "en" : "fr"
    i18n.changeLanguage(next)
    localStorage.setItem("fieldflow-lang", next)
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center rounded-full bg-gray-100 p-0.5 text-xs font-medium"
      aria-label="Toggle language"
    >
      <span
        className={cn(
          "px-2.5 py-1 rounded-full transition-colors",
          current === "FR" ? "bg-ink-blue text-white" : "text-pencil",
        )}
      >
        FR
      </span>
      <span
        className={cn(
          "px-2.5 py-1 rounded-full transition-colors",
          current === "EN" ? "bg-ink-blue text-white" : "text-pencil",
        )}
      >
        EN
      </span>
    </button>
  )
}
