import { NextRequest, NextResponse } from "next/server"
import { CognitoIdentityProviderClient, RespondToAuthChallengeCommand } from "@aws-sdk/client-cognito-identity-provider"
import { z } from "zod"
import { createSessionToken, setAccessCookie, setRefreshCookie, setSessionCookie, verifyCognitoJWT } from "@/lib/auth/middleware"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { getStore } from "@/lib/api/in-memory-store"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const REGION = process.env.AWS_REGION || "us-east-1"

const otpSchema = z.object({
  email: z.string().min(1),
  code: z.string().min(4).max(12),
  session: z.string().min(1),
  challengeName: z.enum(["EMAIL_OTP", "SMS_MFA", "SOFTWARE_TOKEN_MFA"]),
})

function getCognitoClient() {
  return new CognitoIdentityProviderClient({ region: REGION })
}

function codeResponseKey(challengeName: z.infer<typeof otpSchema>["challengeName"]) {
  if (challengeName === "EMAIL_OTP") return "EMAIL_OTP_CODE"
  if (challengeName === "SMS_MFA") return "SMS_MFA_CODE"
  return "SOFTWARE_TOKEN_MFA_CODE"
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request, "auth-otp", 5, 5 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    )
  }

  const parsed = otpSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })

  const { email, code, session, challengeName } = parsed.data

  try {
    const result = await getCognitoClient().send(new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: challengeName,
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        [codeResponseKey(challengeName)]: code,
      },
    }))

    const idToken = result.AuthenticationResult?.IdToken
    const accessToken = result.AuthenticationResult?.AccessToken
    const refreshToken = result.AuthenticationResult?.RefreshToken
    if (!idToken || !accessToken) return NextResponse.json({ error: "Code invalide" }, { status: 401 })

    const tokenUser = await verifyCognitoJWT(idToken)
    if (!tokenUser) return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    const profile = await getStore().getUserProfileByEmailAsync(tokenUser.email)
    const profileOrgId = typeof profile?.orgId === "string" ? profile.orgId : ""
    const profileRole = typeof profile?.role === "string" ? profile.role : ""
    const profileName = typeof profile?.name === "string" ? profile.name : ""
    const authUser = profileOrgId
      ? {
          ...tokenUser,
          name: profileName || tokenUser.name,
          role: profileRole || tokenUser.role,
          groups: [profileRole || tokenUser.role],
          orgId: profileOrgId,
          orgs: [{ id: profileOrgId, name: "" }],
        }
      : tokenUser
    const contextToken = createSessionToken(authUser, 3600)

    const response = NextResponse.json({
      user: { id: authUser.sub, email: authUser.email, name: authUser.name, role: authUser.role, deviceId: "web", token: accessToken, orgId: authUser.orgId },
      org: { id: authUser.orgId, name: "" },
      orgs: [{ id: authUser.orgId, name: "" }],
    })
    response.headers.set("Set-Cookie", setAccessCookie(accessToken, 3600))
    if (refreshToken) response.headers.append("Set-Cookie", setRefreshCookie(refreshToken))
    response.headers.append("Set-Cookie", setSessionCookie(contextToken, 3600))
    return response
  } catch {
    return NextResponse.json({ error: "Code invalide" }, { status: 401 })
  }
}
