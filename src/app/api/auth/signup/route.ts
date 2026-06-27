import { NextResponse } from "next/server"
import { z } from "zod"
import { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider"
import { createSessionToken, setAccessCookie, setRefreshCookie, setSessionCookie } from "@/lib/auth/middleware"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { getStore } from "@/lib/api/in-memory-store"
import { generateId } from "@/lib/utils"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const POOL_ID = process.env.COGNITO_POOL_ID || "us-east-1_kpjmcFVqD"

const signupSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
  orgName: z.string().min(1).max(160),
  orgSector: z.string().min(1).max(80).optional(),
})

function getCognitoClient() {
  return new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  })
}

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "auth-signup", 3, 60 * 60_000)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Trop d'inscriptions. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      )
    }

    const parsed = signupSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })

    const { email, password, name, orgName, orgSector } = parsed.data

    const orgId = generateId()
    const now = Date.now()

    try {
      const cognito = getCognitoClient()
      await cognito.send(new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "name", Value: name },
          { Name: "custom:orgId", Value: orgId },
          { Name: "custom:role", Value: "org_admin" },
        ],
      }))
      await cognito.send(new AdminConfirmSignUpCommand({
        UserPoolId: POOL_ID,
        Username: email,
      }))
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "UsernameExistsException") {
        return NextResponse.json({ error: "Cet email est deja utilise" }, { status: 409 })
      }
      // Cognito unavailable — continue with in-memory only
      console.warn("[signup] Cognito unavailable, using in-memory only:", err instanceof Error ? err.name : "UnknownError")
    }

    const store = getStore()
    try {
      await store.putOrgAsync({ id: orgId, name: orgName, sector: orgSector || "other", createdAt: now, createdBy: email })
      await store.putUserProfileAsync({ userId: email, email, name, role: "org_admin", orgId, active: true, createdAt: now })
    } catch (error) {
      console.error("[signup] store write failed", error)
      return NextResponse.json({ error: "Impossible de créer l'organisation. Vérifiez la configuration DynamoDB." }, { status: 503 })
    }

    const sessionToken = createSessionToken({
      sub: email, email, name, role: "org_admin", groups: ["Administrators"], orgId,
    }, 3600)

    const response = NextResponse.json({
      success: true,
      orgId,
      user: { id: email, email, name, role: "org_admin", deviceId: "web", token: sessionToken, orgId },
      org: { id: orgId, name: orgName },
      orgs: [{ id: orgId, name: orgName }],
      redirect: "/admin/dashboard",
    })

    response.headers.set("Set-Cookie", setSessionCookie(sessionToken, 3600))

    try {
      const cognito = getCognitoClient()
      const auth = await cognito.send(new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }))
      const accessToken = auth.AuthenticationResult?.AccessToken
      const refreshToken = auth.AuthenticationResult?.RefreshToken
      if (accessToken && refreshToken) {
        response.headers.append("Set-Cookie", setAccessCookie(accessToken, 3600))
        response.headers.append("Set-Cookie", setRefreshCookie(refreshToken))
      }
    } catch { /* signed context still supports local signup fallback */ }

    return response
  } catch (error) {
    console.error("[signup] unexpected failure", error)
    return NextResponse.json({ error: "Erreur lors de l'inscription" }, { status: 500 })
  }
}
