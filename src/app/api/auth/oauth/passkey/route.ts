import { NextResponse } from "next/server"

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
  const next = url.searchParams.get("next") || ""
  const redirectUri = callbackUrl(url)
  const state = Buffer.from(JSON.stringify({ mode: "signin", next, provider: "passkey" }), "utf8").toString("base64url")

  const authorizeUrl = new URL(`https://${DOMAIN}/oauth2/authorize`)
  authorizeUrl.searchParams.set("redirect_uri", redirectUri)
  authorizeUrl.searchParams.set("response_type", "CODE")
  authorizeUrl.searchParams.set("client_id", CLIENT_ID)
  authorizeUrl.searchParams.set("scope", "email openid profile aws.cognito.signin.user.admin")
  authorizeUrl.searchParams.set("state", state)

  return NextResponse.redirect(authorizeUrl)
}
