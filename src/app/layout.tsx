import type { Metadata } from "next"
import "@/styles/globals.css"
import "@/lib/i18n/i18n"
import { Toaster } from "@/components/layout/Toaster"
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister"

export const metadata: Metadata = {
  title: "FieldFlow",
  description: "Offline-first humanitarian workflow platform",
  manifest: "/manifest.webmanifest",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600&family=Source+Serif+4:wght@400;600&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=DM+Mono:wght@400;500&family=Cormorant+Garamond:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="font-sans bg-graph-paper text-ink-black antialiased">
        {children}
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
