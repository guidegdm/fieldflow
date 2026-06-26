import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import fr from "./fr.json"
import en from "./en.json"

const resources = { fr: { translation: fr }, en: { translation: en } }

i18next.use(initReactI18next).init({
  resources,
  lng: "fr",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

export default i18next
