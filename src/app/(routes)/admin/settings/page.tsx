"use client"

import { useTranslation } from "react-i18next"

export default function AdminSettings() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
      <h1 className="font-display text-2xl text-lake-deep tracking-tight mb-2">{t("sidebar.settings")}</h1>
      <p className="text-sm text-volcanic-ash">{t("common.noData")}</p>
    </div>
  )
}
