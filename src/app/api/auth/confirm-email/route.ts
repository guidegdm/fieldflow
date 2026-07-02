import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import {
  createPendingSetupToken,
  createSessionToken,
  setAccessCookie,
  setPendingSetupCookie,
  setRefreshCookie,
  setSessionCookie,
  verifyCognitoJWT,
} from "@/lib/auth/middleware"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { COGNITO_PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy"
import { resolveWorkspaceMembership, responseOrgContext } from "@/lib/auth/workspace-membership"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const REGION = process.env.AWS_REGION || "us-east-1"

const confirmEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().min(4).max(12),
  password: z.string().regex(COGNITO_PASSWORD_REQUIREMENT).optional(),
})

function getCognitoClient() {
  return new CognitoIdentityProviderClient({
    region: REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  })
}

function dashboardForRole(role: string) {
  if (role === "field_worker") return "/field-worker/home"
  if (role === "supervisor") return "/supervisor/dashboard"
  return "/admin/dashboard"
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request, "auth-confirm-email", 8, 15 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json(
      { errorCode: "rate_limited", error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    )
  }

  const parsed = confirmEmailSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_request", error: "invalid_request" }, { status: 400 })

  const { email, code, password } = parsed.data
  const cognito = getCognitoClient()

  try {
    await cognito.send(new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    }))
  } catch (error) {
    if (error instanceof Error && error.name !== "NotAuthorizedException") {
      return NextResponse.json({ errorCode: "invalid_code", error: "invalid_code" }, { status: 401 })
    }
  }

  if (!password) return NextResponse.json({ success: true, emailVerified: true })

  try {
    const auth = await cognito.send(new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }))

    const idToken = auth.AuthenticationResult?.IdToken
    const accessToken = auth.AuthenticationResult?.AccessToken
    const refreshToken = auth.AuthenticationResult?.RefreshToken
    if (!idToken || !accessToken) return NextResponse.json({ errorCode: "signin_failed", error: "signin_failed" }, { status: 401 })

    const tokenUser = await verifyCognitoJWT(idToken)
    if (!tokenUser) return NextResponse.json({ errorCode: "invalid_token", error: "invalid_token" }, { status: 401 })

    const authUser = await resolveWorkspaceMembership(tokenUser)
    if (!authUser.orgId) {
      const setupToken = createPendingSetupToken({
        sub: tokenUser.sub || email,
        email,
        name: tokenUser.name || email,
        username: email,
      })
      const response = NextResponse.json({ success: true, emailVerified: true, setupRequired: true, redirect: "/auth/setup" })
      response.headers.set("Set-Cookie", setPendingSetupCookie(setupToken))
      response.headers.append("Set-Cookie", setAccessCookie(accessToken, 3600))
      if (refreshToken) response.headers.append("Set-Cookie", setRefreshCookie(refreshToken))
      return response
    }

    const contextToken = createSessionToken(authUser, 3600)
    const { org, orgs } = await responseOrgContext(authUser)
    const response = NextResponse.json({
      success: true,
      emailVerified: true,
      redirect: dashboardForRole(authUser.role),
      user: { id: authUser.sub, email: authUser.email, name: authUser.name, role: authUser.role, deviceId: "web", token: accessToken, orgId: authUser.orgId },
      org,
      orgs,
    })
    response.headers.set("Set-Cookie", setAccessCookie(accessToken, 3600))
    if (refreshToken) response.headers.append("Set-Cookie", setRefreshCookie(refreshToken))
    response.headers.append("Set-Cookie", setSessionCookie(contextToken, 3600))
    return response
  } catch (error) {
    if (error instanceof Error && error.name === "NotAuthorizedException") {
      return NextResponse.json({ errorCode: "signin_failed", error: "signin_failed" }, { status: 401 })
    }
    console.error("[confirm-email] signin after confirm failed", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ errorCode: "signin_failed", error: "signin_failed" }, { status: 401 })
  }
}
