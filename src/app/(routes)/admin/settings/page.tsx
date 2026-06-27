"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Info } from "lucide-react"

const SECTORS = [
  { value: "shelter", label: "Abri", labelEn: "Shelter" },
  { value: "food", label: "Alimentation", labelEn: "Food" },
  { value: "medical", label: "Médical", labelEn: "Medical" },
  { value: "wash", label: "WASH", labelEn: "WASH" },
  { value: "protection", label: "Protection", labelEn: "Protection" },
  { value: "other", label: "Autre", labelEn: "Other" },
]

const SIZES = ["1-10", "11-50", "51-200"]

export default function AdminSettingsPage() {
  const { t, i18n } = useTranslation()
  const [orgName, setOrgName] = useState("FieldFlow Demo")
  const [sector, setSector] = useState("shelter")
  const [size, setSize] = useState("1-10")
  const [region, setRegion] = useState("Région des Grands Lacs")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isFr = i18n.language === "fr"

  const handleSave = async () => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 800))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-display text-4xl text-lake-deep tracking-tight">{t("admin.settings")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.orgSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label={t("admin.orgName")}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-pencil mb-1">
              {t("admin.orgSector")}
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="flex h-11 w-full rounded-md border border-graph-line px-3 py-2 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue"
            >
              {SECTORS.map((s) => (
                <option key={s.value} value={s.value}>
                  {isFr ? s.label : s.labelEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-pencil mb-1">
              {t("admin.orgSize")}
            </label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="flex h-11 w-full rounded-md border border-graph-line px-3 py-2 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue"
            >
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t("admin.region")}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
          <div className="pt-2">
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {saved ? t("common.success") : t("common.save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-danger-500/30">
        <CardHeader>
          <CardTitle className="text-danger-500">{t("admin.dangerZone")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="group relative inline-block">
            <Button variant="danger" disabled>
              {t("admin.deleteOrg")}
            </Button>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-md bg-ink-black px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 text-center">
              <Info size={12} className="inline mr-1" />
              {t("admin.deleteDisabledTooltip")}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
