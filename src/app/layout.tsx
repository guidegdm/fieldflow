import type { Metadata } from "next"
import "@/styles/globals.css"
import { ClientLayout } from "@/components/layout/ClientLayout"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://fieldflow.vercel.app"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FieldFlow | Offline Field Operations Platform",
    template: "%s | FieldFlow",
  },
  description: "Offline-first workflows, DynamoDB-backed sync, and transactional inventory controls for field teams working beyond reliable networks.",
  applicationName: "FieldFlow",
  keywords: [
    "offline-first",
    "field operations",
    "humanitarian technology",
    "DynamoDB",
    "Vercel",
    "workflow builder",
    "inventory reservation",
  ],
  authors: [{ name: "FieldFlow" }],
  creator: "FieldFlow",
  publisher: "FieldFlow",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "FieldFlow",
    title: "FieldFlow | Offline Field Operations Platform",
    description: "DynamoDB-backed sync, conflict review, and transactional inventory for field teams working beyond reliable networks.",
    images: [
      {
        url: "/brand/fieldflow-og.png",
        width: 1200,
        height: 630,
        alt: "FieldFlow offline field operations platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FieldFlow | Offline Field Operations Platform",
    description: "Offline-first workflows for field teams, powered by Vercel and Amazon DynamoDB.",
    images: ["/brand/fieldflow-twitter.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
        <meta name="theme-color" content="#F8F9FA" />
      </head>
      <body className="font-sans bg-graph-paper text-ink-black antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
