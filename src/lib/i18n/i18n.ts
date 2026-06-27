import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import fr from "./fr.json"
import en from "./en.json"

const resources = { fr: { translation: fr }, en: { translation: en } }
export type AppLanguage = "fr" | "en"
export const LANGUAGE_STORAGE_KEY = "fieldflow-lang"

function normalizeLanguage(value: string | undefined | null): AppLanguage | null {
  if (!value) return null
  if (value.toLowerCase().startsWith("fr")) return "fr"
  if (value.toLowerCase().startsWith("en")) return "en"
  return null
}

export function detectLanguage(): AppLanguage {
  if (typeof window !== "undefined") {
    const stored = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))
    if (stored) return stored
    return normalizeLanguage(navigator.language) ?? "fr"
  }
  return "fr"
}

if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    resources,
    lng: "fr",
    fallbackLng: "fr",
    supportedLngs: ["fr", "en"],
    cleanCode: true,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  })
}

export async function setAppLanguage(language: AppLanguage) {
  if (typeof window !== "undefined") {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
  }
  await i18next.changeLanguage(language)
}

export default i18next
