import { NextResponse } from "next/server"
import { createOAuthStateToken, setOAuthStateCookie } from "@/lib/auth/middleware"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const DOMAIN = process.env.COGNITO_DOMAIN || process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "fieldflow-hackathon.auth.us-east-1.amazoncognito.com"

function callbackUrl(requestUrl: URL) {
  const explicit = process.env.COGNITO_REDIRECT_URI
  if (explicit) return explicit

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (siteUrl) return `${new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).origin}/api/auth/callback`

  return `${requestUrl.origin}/api/auth/callback`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get("mode") === "signup" ? "signup" : "signin"
  const next = url.searchParams.get("next") || ""
  const redirectUri = callbackUrl(url)
  const state = createOAuthStateToken({ mode, next, provider: "google" })

  const authorizeUrl = new URL(`https://${DOMAIN}/oauth2/authorize`)
  authorizeUrl.searchParams.set("identity_provider", "Google")
  authorizeUrl.searchParams.set("redirect_uri", redirectUri)
  authorizeUrl.searchParams.set("response_type", "code")
  authorizeUrl.searchParams.set("client_id", CLIENT_ID)
  authorizeUrl.searchParams.set("scope", "email openid profile")
  authorizeUrl.searchParams.set("state", state)

  const response = NextResponse.redirect(authorizeUrl)
  response.headers.set("Set-Cookie", setOAuthStateCookie(state))
  return response
}
