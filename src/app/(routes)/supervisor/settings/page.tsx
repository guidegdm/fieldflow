"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { setAppLanguage, type AppLanguage } from "@/lib/i18n/i18n"

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
]

const SYNC_INTERVALS = [
  { value: "30", label: "30 secondes" },
  { value: "60", label: "1 minute" },
  { value: "300", label: "5 minutes" },
  { value: "900", label: "15 minutes" },
]

export default function SupervisorSettingsPage() {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState(i18n.language)
  const [syncInterval, setSyncInterval] = useState("60")
  const [offlineMode, setOfflineMode] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setLanguage(i18n.resolvedLanguage?.startsWith("en") ? "en" : "fr")
  }, [i18n.resolvedLanguage])

  const handleSave = async () => {
    setSaving(true)
    await setAppLanguage(language as AppLanguage)
    await new Promise((r) => setTimeout(r, 600))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 sm:space-y-8">
      <h1 className="font-display text-3xl tracking-tight text-iodine-brown sm:text-4xl">{t("supervisor.settings", "Paramètres")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("supervisor.preferences", "Préférences")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Select
              label={t("supervisor.language", "Langue")}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </Select>
          </div>

          <div>
            <Select
              label={t("supervisor.syncInterval", "Intervalle de synchronisation")}
              value={syncInterval}
              onChange={(e) => setSyncInterval(e.target.value)}
            >
              {SYNC_INTERVALS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="offlineMode"
              type="checkbox"
              checked={offlineMode}
              onChange={(e) => setOfflineMode(e.target.checked)}
              className="h-4 w-4 rounded border-graph-line text-ink-blue focus:ring-ink-blue"
            />
            <label htmlFor="offlineMode" className="text-sm text-ink-black">
              {t("supervisor.offlineMode", "Mode hors-ligne prioritaire")}
            </label>
          </div>

          <div className="pt-2">
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {saved ? t("common.success", "Enregistré") : t("common.save", "Sauvegarder")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("supervisor.about", "À propos")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-pencil">
          <p>FieldFlow v1.0.0</p>
          <p>{t("supervisor.buildInfo", "Build 2026-06-27 — Hackathon H0 2026")}</p>
        </CardContent>
      </Card>
    </div>
  )
}
