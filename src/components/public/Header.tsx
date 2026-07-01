"use client"

import Link from "next/link"
import { useTranslation } from "react-i18next"
import { LanguageToggle } from "@/components/layout/LanguageToggle"
import { PublicAccountMenu } from "@/components/public/PublicAccountMenu"

export function Header() {
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-grid-line bg-graph-paper/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <Link href="/" className="flex min-w-0 items-center gap-2.5 font-display text-lg font-bold tracking-tight text-lake-deep sm:text-xl">
        <img src="/brand/fieldflow-logo-square.webp" alt="" className="h-8 w-8 rounded-sm object-contain" />
        <span className="hidden sm:inline">FieldFlow</span>
      </Link>
      <nav className="flex shrink-0 items-center gap-2 text-sm sm:gap-4">
        <Link href="/demo" className="hidden text-pencil transition-colors hover:text-ink-black sm:inline">
          {t("publicHeader.demo")}
        </Link>
        <PublicAccountMenu />
        <LanguageToggle />
      </nav>
    </header>
  )
}
