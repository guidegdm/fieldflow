import type { NextConfig } from "next"
import withPWAInit from "next-pwa"

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://api.deepseek.com https://*.amazonaws.com https://*.amazoncognito.com https://fonts.googleapis.com https://fonts.gstatic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
]

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  customWorkerDir: "worker",
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
      handler: "NetworkOnly",
      method: "GET",
      options: {
        cacheName: "fieldflow-api-network-only",
      },
    },
    {
      urlPattern: ({ request, url }) =>
        request.mode === "navigate" ||
        request.destination === "document" ||
        (
          request.method === "GET" &&
          url.origin === self.location.origin &&
          !url.pathname.startsWith("/api/") &&
          !url.pathname.startsWith("/_next/") &&
          !/\.[^/]+$/.test(url.pathname)
        ),
      handler: "NetworkFirst",
      options: {
        cacheName: "fieldflow-pages",
        networkTimeoutSeconds: 3,
      },
    },
    {
      urlPattern: ({ request }) => ["style", "script", "worker"].includes(request.destination),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "fieldflow-assets",
      },
    },
    {
      urlPattern: ({ request }) => request.destination === "image",
      handler: "CacheFirst",
      options: {
        cacheName: "fieldflow-images",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
  ],
})

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/_next/static/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ]
  },
}

export default withPWA(nextConfig)
