import { NextResponse } from "next/server"
import { z } from "zod"
import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { createSessionToken, setAccessCookie, setRefreshCookie, setSessionCookie, verifyCognitoJWT } from "@/lib/auth/middleware"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { getStore } from "@/lib/api/in-memory-store"
import { generateId } from "@/lib/utils"
import { COGNITO_PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const POOL_ID = process.env.COGNITO_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_POOL_ID || "us-east-1_kpjmcFVqD"
const REGION = process.env.AWS_REGION || "us-east-1"

const confirmSchema = z.object({
  email: z.string().min(1),
  code: z.string().min(4).max(12),
  password: z.string().regex(COGNITO_PASSWORD_REQUIREMENT),
  name: z.string().min(1).max(120),
  orgName: z.string().min(1).max(160),
  orgSector: z.string().min(1).max(80).optional(),
})

const passwordPolicyError = "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un symbole."

function getCognitoClient() {
  return new CognitoIdentityProviderClient({
    region: REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  })
}

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "auth-confirm-signup", 8, 15 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    )
  }

  const body = await request.json()
  const parsed = confirmSchema.safeParse(body)
  if (!parsed.success) {
    if (typeof body?.password === "string" && !COGNITO_PASSWORD_REQUIREMENT.test(body.password)) {
      return NextResponse.json({ error: passwordPolicyError }, { status: 400 })
    }
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  const { email, code, password, name, orgName, orgSector } = parsed.data
  const cognito = getCognitoClient()

  try {
    await cognito.send(new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    }))
  } catch (error) {
    if (error instanceof Error && error.name !== "NotAuthorizedException") {
      return NextResponse.json({ error: "Code de vérification invalide" }, { status: 401 })
    }
  }

  const orgId = generateId()
  const now = Date.now()
  const store = getStore()

  try {
    await store.putOrgAsync({ id: orgId, name: orgName, sector: orgSector || "other", createdAt: now, createdBy: email })
    await store.putUserProfileAsync({
      userId: email,
      email,
      name,
      role: "org_admin",
      orgId,
      active: true,
      emailVerified: true,
      authProvider: "cognito",
      createdAt: now,
    })
    await cognito.send(new AdminUpdateUserAttributesCommand({
      UserPoolId: POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: "name", Value: name },
        { Name: "custom:role", Value: "org_admin" },
        { Name: "email_verified", Value: "true" },
      ],
    }))
  } catch (error) {
    console.error("[confirm-signup] store write failed", error)
    return NextResponse.json({ error: "Impossible de créer l'organisation. Vérifiez la configuration DynamoDB." }, { status: 503 })
  }

  const auth = await cognito.send(new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  }))
  const idToken = auth.AuthenticationResult?.IdToken
  const accessToken = auth.AuthenticationResult?.AccessToken
  const refreshToken = auth.AuthenticationResult?.RefreshToken
  const tokenUser = idToken ? await verifyCognitoJWT(idToken, { orgId, role: "org_admin", email, name }) : null
  const authUser = {
    ...(tokenUser ?? { sub: email, email, name }),
    role: "org_admin",
    groups: ["org_admin"],
    orgId,
    orgs: [{ id: orgId, name: orgName, role: "org_admin" }],
  }
  const sessionToken = createSessionToken(authUser, 3600)

  const response = NextResponse.json({
    success: true,
    orgId,
    user: { id: authUser.sub, email, name, role: "org_admin", deviceId: "web", token: accessToken || sessionToken, orgId },
    org: { id: orgId, name: orgName, role: "org_admin" },
    orgs: [{ id: orgId, name: orgName, role: "org_admin" }],
    redirect: "/admin/dashboard",
  })

  if (accessToken) response.headers.set("Set-Cookie", setAccessCookie(accessToken, 3600))
  if (refreshToken) response.headers.append("Set-Cookie", setRefreshCookie(refreshToken))
  response.headers.append("Set-Cookie", setSessionCookie(sessionToken, 3600))
  return response
}
