"use client"

import Link from "next/link"
import { LanguageToggle } from "@/components/layout/LanguageToggle"

export function Header() {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-grid-line bg-kivu-paper">
      <Link href="/" className="font-display text-xl font-bold text-lake-deep tracking-tight">
        FieldFlow
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link href="/demo" className="text-pencil hover:text-ink-black transition-colors">
          Démo
        </Link>
        <Link href="/auth/signin" className="text-pencil hover:text-ink-black transition-colors">
          Connexion
        </Link>
        <Link
          href="/auth/signup"
          className="rounded-md bg-ink-blue text-white px-4 py-2 font-medium text-sm hover:bg-ink-blue/90 transition-colors"
        >
          Commencer
        </Link>
        <LanguageToggle />
      </nav>
    </header>
  )
}
