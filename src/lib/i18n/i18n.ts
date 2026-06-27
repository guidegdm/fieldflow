import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import fr from "./fr.json"
import en from "./en.json"

const resources = { fr: { translation: fr }, en: { translation: en } }

function detectLanguage(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("fieldflow-lang")
    if (stored === "fr" || stored === "en") return stored
    const browser = navigator.language || ""
    if (browser.startsWith("fr")) return "fr"
    return "en"
  }
  return "fr"
}

i18next.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
})

export default i18next
