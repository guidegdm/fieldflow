import { NextResponse } from "next/server"
import { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } from "@aws-sdk/client-cognito-identity-provider"
import { setSessionCookie, registerSessionToken } from "@/lib/auth/middleware"
import { getStore } from "@/lib/api/in-memory-store"
import { generateId } from "@/lib/utils"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const POOL_ID = process.env.COGNITO_POOL_ID || "us-east-1_kpjmcFVqD"

function getCognitoClient() {
  return new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  })
}

export async function POST(request: Request) {
  try {
    const { email, password, name, orgName, orgSector } = await request.json()
    if (!email || !password || !name || !orgName) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })
    }

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
    } catch (err: any) {
      if (err?.name === "UsernameExistsException") {
        return NextResponse.json({ error: "Cet email est deja utilise" }, { status: 409 })
      }
      // Cognito unavailable — continue with in-memory only
      console.warn("[signup] Cognito unavailable, using in-memory only:", err?.name)
    }

    const store = getStore()
    store.putOrg({ id: orgId, name: orgName, sector: orgSector || "other", createdAt: now, createdBy: email })
    store.putUserProfile({ pk: `USER#${email}`, sk: "PROFILE", userId: email, email, name, role: "org_admin", orgId, active: true, createdAt: now })

    const sessionToken = generateId()
    const tokenKey = `session-${sessionToken}`

    registerSessionToken(tokenKey, {
      sub: email, email, name, role: "org_admin", groups: ["Administrators"], orgId,
    })

    const response = NextResponse.json({
      success: true,
      orgId,
      user: { id: email, email, name, role: "org_admin", orgId },
      org: { id: orgId, name: orgName },
      redirect: "/admin/dashboard",
    })

    response.headers.set("Set-Cookie", setSessionCookie(tokenKey, 86400))

    return response
  } catch (error: any) {
    return NextResponse.json({ error: "Erreur lors de l'inscription" }, { status: 500 })
  }
}
