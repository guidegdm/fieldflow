import { NextResponse } from "next/server"
import { createPendingSetupToken, createSessionToken, setAccessCookie, setPendingSetupCookie, setRefreshCookie, setSessionCookie, verifyCognitoJWT } from "@/lib/auth/middleware"
import { getStore } from "@/lib/api/in-memory-store"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const DOMAIN = process.env.COGNITO_DOMAIN || process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "fieldflow-hackathon.auth.us-east-1.amazoncognito.com"

function callbackUrl(requestUrl: URL) {
  const explicit = process.env.COGNITO_REDIRECT_URI
  if (explicit) return explicit

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (siteUrl) return `${new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).origin}/api/auth/callback`

  return `${requestUrl.origin}/api/auth/callback`
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>
  } catch {
    return null
  }
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
  const payload = decodeJwtPayload(tokens.id_token)

  if (authUser) {
    const existingProfile = await getStore().getUserProfileByEmailAsync(authUser.email)
    const orgId = typeof existingProfile?.orgId === "string" ? existingProfile.orgId : ""
    const name = typeof existingProfile?.name === "string" ? existingProfile.name : authUser.name
    const role = typeof existingProfile?.role === "string" ? existingProfile.role : authUser.role
    if (orgId) {
      authUser = {
        ...authUser,
        name,
        role,
        groups: [role],
        orgId,
        orgs: [{ id: orgId, name: "" }],
      }
    }
  }

  if (!authUser && payload) {
    const email = String(payload.email || "")
    const name = String(payload.name || email)
    const username = String(payload["cognito:username"] || payload.sub || email)

    if (email) {
      const store = getStore()
      const existingProfile = await store.getUserProfileByEmailAsync(email)
      const orgId = typeof existingProfile?.orgId === "string" ? existingProfile.orgId : ""
      const existingName = typeof existingProfile?.name === "string" ? existingProfile.name : name
      const role = typeof existingProfile?.role === "string" ? existingProfile.role : "org_admin"

      if (orgId) {
        authUser = {
          sub: String(payload.sub || email),
          email,
          name: existingName,
          role,
          groups: [role],
          orgId,
          orgs: [{ id: orgId, name: "" }],
        }
      } else {
        const setupToken = createPendingSetupToken({
          sub: String(payload.sub || email),
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

  if (!authUser) {
    const redirectUrl = new URL("/auth/signin", url.origin)
    redirectUrl.searchParams.set("error", "invalid_token")
    return NextResponse.redirect(redirectUrl)
  }

  const response = NextResponse.redirect(new URL(dashboardForRole(authUser.role), url.origin))
  response.headers.set("Set-Cookie", setAccessCookie(token, 3600))
  if (tokens.refresh_token) response.headers.append("Set-Cookie", setRefreshCookie(tokens.refresh_token))
  response.headers.append("Set-Cookie", setSessionCookie(createSessionToken(authUser, 3600), 3600))
  return response
}
