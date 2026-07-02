import { NextRequest, NextResponse } from "next/server"
import { CognitoIdentityProviderClient, RespondToAuthChallengeCommand } from "@aws-sdk/client-cognito-identity-provider"
import { z } from "zod"
import { createSessionToken, setAccessCookie, setRefreshCookie, setSessionCookie, verifyCognitoJWT } from "@/lib/auth/middleware"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { resolveWorkspaceMembership, responseOrgContext } from "@/lib/auth/workspace-membership"
import { COGNITO_PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const REGION = process.env.AWS_REGION || "us-east-1"

const otpSchema = z.object({
  email: z.string().min(1),
  code: z.string().min(4).max(12).optional(),
  newPassword: z.string().min(8).max(128).optional(),
  session: z.string().min(1),
  challengeName: z.enum(["EMAIL_OTP", "SMS_MFA", "SOFTWARE_TOKEN_MFA", "NEW_PASSWORD_REQUIRED"]),
})

const passwordPolicyError = "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un symbole."

function getCognitoClient() {
  return new CognitoIdentityProviderClient({ region: REGION })
}

function codeResponseKey(challengeName: z.infer<typeof otpSchema>["challengeName"]) {
  if (challengeName === "EMAIL_OTP") return "EMAIL_OTP_CODE"
  if (challengeName === "SMS_MFA") return "SMS_MFA_CODE"
  if (challengeName === "NEW_PASSWORD_REQUIRED") return "NEW_PASSWORD"
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

  const { email, code, newPassword, session, challengeName } = parsed.data
  const challengeValue = challengeName === "NEW_PASSWORD_REQUIRED" ? newPassword : code
  if (!challengeValue) return NextResponse.json({ error: "Code invalide" }, { status: 400 })
  if (challengeName === "NEW_PASSWORD_REQUIRED" && !COGNITO_PASSWORD_REQUIREMENT.test(challengeValue)) {
    return NextResponse.json({ error: passwordPolicyError }, { status: 400 })
  }

  try {
    const result = await getCognitoClient().send(new RespondToAuthChallengeCommand({
      ClientId: CLIENT_ID,
      ChallengeName: challengeName,
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        [codeResponseKey(challengeName)]: challengeValue,
      },
    }))

    const idToken = result.AuthenticationResult?.IdToken
    const accessToken = result.AuthenticationResult?.AccessToken
    const refreshToken = result.AuthenticationResult?.RefreshToken
    if (!idToken || !accessToken) return NextResponse.json({ error: "Code invalide" }, { status: 401 })

    const tokenUser = await verifyCognitoJWT(idToken)
    if (!tokenUser) return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    const authUser = await resolveWorkspaceMembership(tokenUser)
    if (!authUser.orgId) return NextResponse.json({ error: "Workspace membership required" }, { status: 403 })
    const contextToken = createSessionToken(authUser, 3600)
    const { org, orgs } = await responseOrgContext(authUser)

    const response = NextResponse.json({
      user: { id: authUser.sub, email: authUser.email, name: authUser.name, role: authUser.role, deviceId: "web", token: accessToken, orgId: authUser.orgId },
      org,
      orgs,
    })
    response.headers.set("Set-Cookie", setAccessCookie(accessToken, 3600))
    if (refreshToken) response.headers.append("Set-Cookie", setRefreshCookie(refreshToken))
    response.headers.append("Set-Cookie", setSessionCookie(contextToken, 3600))
    return response
  } catch (error) {
    if (error instanceof Error && error.name === "InvalidPasswordException") {
      return NextResponse.json({ error: passwordPolicyError }, { status: 400 })
    }
    return NextResponse.json({ error: "Code invalide" }, { status: 401 })
  }
}
