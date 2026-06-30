import { NextResponse, type NextRequest } from "next/server"

const DEV_SESSION_SECRET = process.env.NODE_ENV === "production" ? "" : "fieldflow-local-dev-session-secret"

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || DEV_SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET is required in production")
  return secret
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  return atob(padded)
}

function encodeBase64Url(bytes: ArrayBuffer): string {
  let binary = ""
  const view = new Uint8Array(bytes)
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return encodeBase64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)))
}

async function extractSignedOrgId(token: string): Promise<string | null> {
  if (!token.startsWith("session-")) return null
  const raw = token.slice("session-".length)
  const [payload, signature] = raw.split(".")
  if (!payload || !signature) return null
  if (await sign(payload) !== signature) return null

  try {
    const decoded = JSON.parse(decodeBase64Url(payload)) as { exp?: number; orgId?: unknown }
    if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) return null
    return typeof decoded.orgId === "string" ? decoded.orgId : null
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const orgId = await extractSignedOrgId(request.cookies.get("ff_session")?.value || "")
  if (!orgId) return NextResponse.next()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-fieldflow-org-id", orgId)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    "/api/:path*",
    "/admin/:path*",
    "/supervisor/:path*",
    "/field-worker/:path*",
    "/engineering/:path*",
  ],
}
