"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

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

  const handleSave = async () => {
    setSaving(true)
    await i18n.changeLanguage(language)
    await new Promise((r) => setTimeout(r, 600))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-display text-4xl text-lake-deep tracking-tight">{t("supervisor.settings", "Paramètres")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("supervisor.preferences", "Préférences")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-pencil mb-1">
              {t("supervisor.language", "Langue")}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="flex h-11 w-full rounded-md border border-graph-line px-3 py-2 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-pencil mb-1">
              {t("supervisor.syncInterval", "Intervalle de synchronisation")}
            </label>
            <select
              value={syncInterval}
              onChange={(e) => setSyncInterval(e.target.value)}
              className="flex h-11 w-full rounded-md border border-graph-line px-3 py-2 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue"
            >
              {SYNC_INTERVALS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="offlineMode"
              type="checkbox"
              checked={offlineMode}
              onChange={(e) => setOfflineMode(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-ink-blue focus:ring-ink-blue"
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
