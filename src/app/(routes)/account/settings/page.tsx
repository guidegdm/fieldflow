"use client"

import { useTranslation } from "react-i18next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LanguagePreferenceSelect } from "@/components/layout/LanguagePreferenceSelect"
import { useAuthStore } from "@/stores/authStore"

export default function AccountSettingsPage() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const org = useAuthStore((state) => state.org)

  return (
    <div className="mx-auto max-w-3xl space-y-6 sm:space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-lake-deep sm:text-4xl">
          {t("account.settings", "Account settings")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-pencil">
          {t("account.settingsHelp", "These preferences follow this browser/PWA across every workspace you use.")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.preferences", "Preferences")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <LanguagePreferenceSelect />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.currentContext", "Current context")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-pencil">{t("account.user", "User")}</p>
            <p className="mt-1 font-medium text-ink-black">{user?.name || user?.email || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-pencil">{t("account.workspace", "Workspace")}</p>
            <p className="mt-1 font-medium text-ink-black">{org?.name || "-"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
