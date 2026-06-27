import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod"
import { DEMO_USERS, ORG_MEMBERSHIPS } from "@/types/auth"
import { createSessionToken, getOrCreateDemoInstall, setAccessCookie, setDemoInstallCookie, setRefreshCookie, setSessionCookie, verifyCognitoJWT } from "@/lib/auth/middleware"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { seedIsolatedDemoOrg } from "@/lib/demo/seed-demo-org"
import { InitiateAuthCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const REGION = process.env.AWS_REGION || "us-east-1"

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1).optional(),
  demoOrgKey: z.enum(["AHK", "SRB", "LE"]).optional(),
})

function getCognitoClient() {
  return new CognitoIdentityProviderClient({ region: REGION })
}

export async function POST(request: NextRequest) {
  try {
    const parsed = loginSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })

    const { email, password, demoOrgKey } = parsed.data
    const demoUser = DEMO_USERS.find((u) => u.email === email)

    const rate = demoUser
      ? checkRateLimit(request, "auth-demo-login", 30, 60_000)
      : checkRateLimit(request, "auth-login", 5, 60_000)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      )
    }

    if (demoUser) {
      if (demoOrgKey && !ORG_MEMBERSHIPS.some((membership) => membership.userId === demoUser.id && membership.orgKey === demoOrgKey)) {
        return NextResponse.json({ error: "Organisation demo interdite" }, { status: 403 })
      }
      const demoInstall = getOrCreateDemoInstall(request)
      const seeded = await seedIsolatedDemoOrg(demoUser, demoInstall.installId, demoOrgKey)
      const sessionToken = createSessionToken({
        sub: seeded.user.id,
        email: seeded.user.email,
        name: seeded.user.name,
        role: seeded.user.role,
        groups: [seeded.user.role],
        orgId: seeded.org.id,
        orgs: seeded.orgs,
      })
      const response = NextResponse.json({
        user: {
          id: seeded.user.id,
          email: seeded.user.email,
          name: seeded.user.name,
          role: seeded.user.role,
          deviceId: seeded.user.deviceId,
          token: sessionToken,
          orgId: seeded.org.id,
        },
        org: seeded.org,
        orgs: seeded.orgs,
        demo: {
          installId: demoInstall.installId.slice(0, 12),
          workspace: seeded.org.id,
          seeded: seeded.seeded,
        },
      })
      response.headers.set("Set-Cookie", setSessionCookie(sessionToken))
      response.headers.append("Set-Cookie", setDemoInstallCookie(demoInstall.token))
      return response
    }

    if (!password) return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 })

    const cognito = getCognitoClient()
    const result = await cognito.send(new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }))

    if (result.ChallengeName && result.Session) {
      const supported = ["EMAIL_OTP", "SMS_MFA", "SOFTWARE_TOKEN_MFA"].includes(result.ChallengeName)
      if (supported) {
        return NextResponse.json({
          challenge: result.ChallengeName,
          session: result.Session,
          email,
        })
      }
      return NextResponse.json({ error: `Challenge non supporté: ${result.ChallengeName}` }, { status: 401 })
    }

    const idToken = result.AuthenticationResult?.IdToken
    const accessToken = result.AuthenticationResult?.AccessToken
    const refreshToken = result.AuthenticationResult?.RefreshToken
    if (!idToken || !accessToken || !refreshToken) return NextResponse.json({ error: "Échec d'authentification" }, { status: 401 })

    const authUser = await verifyCognitoJWT(idToken)
    if (!authUser) return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    const contextToken = createSessionToken(authUser, 3600)

    const response = NextResponse.json({
      user: { id: authUser.sub, email: authUser.email, name: authUser.name, role: authUser.role, deviceId: "web", token: accessToken, orgId: authUser.orgId },
      org: { id: authUser.orgId, name: "" },
      orgs: [{ id: authUser.orgId, name: "" }],
    })
    response.headers.set("Set-Cookie", setAccessCookie(accessToken, 3600))
    response.headers.append("Set-Cookie", setRefreshCookie(refreshToken))
    response.headers.append("Set-Cookie", setSessionCookie(contextToken, 3600))
    return response
  } catch (error: unknown) {
    console.error("[login] error:", error instanceof Error ? error.message : String(error), error instanceof Error ? error.stack : "")
    if (error instanceof Error && error.name === "NotAuthorizedException") {
      return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 })
    }
    if (error instanceof Error && error.name === "UserNotFoundException") {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 401 })
    }
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }
}
