import { NextResponse } from "next/server"
import { createPendingSetupToken, createSessionToken, setAccessCookie, setPendingSetupCookie, setRefreshCookie, setSessionCookie, verifyCognitoJWT } from "@/lib/auth/middleware"
import { getStore } from "@/lib/api/in-memory-store"
import { resolveWorkspaceMembership } from "@/lib/auth/workspace-membership"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const DOMAIN = process.env.COGNITO_DOMAIN || process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "fieldflow-hackathon.auth.us-east-1.amazoncognito.com"

function callbackUrl(requestUrl: URL) {
  const explicit = process.env.COGNITO_REDIRECT_URI
  if (explicit) return explicit

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (siteUrl) return `${new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).origin}/api/auth/callback`

  return `${requestUrl.origin}/api/auth/callback`
}

function dashboardForRole(role: string) {
  if (role === "field_worker") return "/field-worker/home"
  if (role === "supervisor") return "/supervisor/dashboard"
  return "/admin/dashboard"
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")

  if (error || !code) {
    const redirectUrl = new URL("/auth/signin", url.origin)
    redirectUrl.searchParams.set("error", error || "no_code")
    return NextResponse.redirect(redirectUrl)
  }

  const redirectUri = callbackUrl(url)

  const tokenRes = await fetch(`https://${DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      code,
    }),
  })

  if (!tokenRes.ok) {
    const redirectUrl = new URL("/auth/signin", url.origin)
    redirectUrl.searchParams.set("error", "token_exchange_failed")
    return NextResponse.redirect(redirectUrl)
  }

  const tokens = (await tokenRes.json()) as { access_token?: string; id_token?: string; refresh_token?: string }
  const token = tokens.access_token || tokens.id_token

  if (!token || !tokens.id_token) {
    const redirectUrl = new URL("/auth/signin", url.origin)
    redirectUrl.searchParams.set("error", "no_token")
    return NextResponse.redirect(redirectUrl)
  }

  let authUser = await verifyCognitoJWT(tokens.id_token)
  if (!authUser) {
    const redirectUrl = new URL("/auth/signin", url.origin)
    redirectUrl.searchParams.set("error", "invalid_token")
    return NextResponse.redirect(redirectUrl)
  }

  authUser = await resolveWorkspaceMembership(authUser)

  if (!authUser.orgId) {
    const email = authUser.email
    const name = authUser.name || email
    const username = authUser.sub || email

    if (email) {
      const store = getStore()
      const profiles = await store.listUserProfilesByEmailAsync(email)
      if (profiles.length > 0) {
        authUser = await resolveWorkspaceMembership({
          sub: authUser.sub,
          email,
          name,
          role: "field_worker",
          groups: ["field_worker"],
          orgId: "",
          orgs: [],
        })
      } else {
        const setupToken = createPendingSetupToken({
          sub: authUser.sub || email,
          email,
          name,
          username,
        })
        const response = NextResponse.redirect(new URL("/auth/setup", url.origin))
        response.headers.set("Set-Cookie", setPendingSetupCookie(setupToken))
        response.headers.append("Set-Cookie", setAccessCookie(tokens.access_token || tokens.id_token, 3600))
        if (tokens.refresh_token) response.headers.append("Set-Cookie", setRefreshCookie(tokens.refresh_token))
        return response
      }
    }
  }

  if (!authUser.orgId) {
    const redirectUrl = new URL("/auth/signin", url.origin)
    redirectUrl.searchParams.set("error", "workspace_required")
    return NextResponse.redirect(redirectUrl)
  }

  const response = NextResponse.redirect(new URL(dashboardForRole(authUser.role), url.origin))
  response.headers.set("Set-Cookie", setAccessCookie(token, 3600))
  if (tokens.refresh_token) response.headers.append("Set-Cookie", setRefreshCookie(tokens.refresh_token))
  response.headers.append("Set-Cookie", setSessionCookie(createSessionToken(authUser, 3600), 3600))
  return response
}
