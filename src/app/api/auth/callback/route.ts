import { NextResponse } from "next/server"
import { createSessionToken, setAccessCookie, setRefreshCookie, setSessionCookie, verifyCognitoJWT } from "@/lib/auth/middleware"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")

  if (error || !code) {
    const redirectUrl = new URL("/auth/signin", url.origin)
    redirectUrl.searchParams.set("error", error || "no_code")
    return NextResponse.redirect(redirectUrl)
  }

  const domain = "fieldflow-hackathon.auth.us-east-1.amazoncognito.com"
  const clientId = "7r60o7fnej4vitoksrp6e93n9g"
  const redirectUri = `${url.origin}/auth/callback`

  const tokenRes = await fetch(`https://${domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
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

  const authUser = await verifyCognitoJWT(tokens.id_token)
  if (!authUser) {
    const redirectUrl = new URL("/auth/signin", url.origin)
    redirectUrl.searchParams.set("error", "invalid_token")
    return NextResponse.redirect(redirectUrl)
  }

  const response = NextResponse.redirect(new URL("/admin/dashboard", url.origin))
  response.headers.set("Set-Cookie", setAccessCookie(token, 3600))
  if (tokens.refresh_token) response.headers.append("Set-Cookie", setRefreshCookie(tokens.refresh_token))
  response.headers.append("Set-Cookie", setSessionCookie(createSessionToken(authUser, 3600), 3600))
  return response
}
