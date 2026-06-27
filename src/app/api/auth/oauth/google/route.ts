import { NextResponse } from "next/server"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const DOMAIN = process.env.COGNITO_DOMAIN || process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "fieldflow-hackathon.auth.us-east-1.amazoncognito.com"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get("mode") === "signup" ? "signup" : "signin"
  const next = url.searchParams.get("next") || ""
  const redirectUri = `${url.origin}/api/auth/callback`
  const state = Buffer.from(JSON.stringify({ mode, next }), "utf8").toString("base64url")

  const authorizeUrl = new URL(`https://${DOMAIN}/oauth2/authorize`)
  authorizeUrl.searchParams.set("identity_provider", "Google")
  authorizeUrl.searchParams.set("redirect_uri", redirectUri)
  authorizeUrl.searchParams.set("response_type", "CODE")
  authorizeUrl.searchParams.set("client_id", CLIENT_ID)
  authorizeUrl.searchParams.set("scope", "email openid profile")
  authorizeUrl.searchParams.set("state", state)

  return NextResponse.redirect(authorizeUrl)
}
