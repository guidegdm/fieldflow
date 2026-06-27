import { NextResponse } from "next/server"
import { DEMO_USERS } from "@/types/auth"
import { setSessionCookie, verifyCognitoJWT } from "@/lib/auth/middleware"
import { InitiateAuthCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const REGION = process.env.AWS_REGION || "us-east-1"

function getCognitoClient() {
  return new CognitoIdentityProviderClient({ region: REGION })
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 })

    const demoUser = DEMO_USERS.find((u) => u.email === email)
    if (demoUser) {
      const response = NextResponse.json({
        user: { id: demoUser.id, email: demoUser.email, name: demoUser.name, role: demoUser.role, deviceId: demoUser.deviceId, orgId: demoUser.orgId },
        org: { id: demoUser.orgId, name: "Organisation Démo" },
      })
      response.headers.set("Set-Cookie", setSessionCookie(demoUser.token))
      return response
    }

    if (!password) return NextResponse.json({ error: "Mot de passe requis" }, { status: 400 })

    const cognito = getCognitoClient()
    const result = await cognito.send(new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }))

    const idToken = result.AuthenticationResult?.IdToken
    if (!idToken) return NextResponse.json({ error: "Échec d'authentification" }, { status: 401 })

    const authUser = await verifyCognitoJWT(idToken)
    if (!authUser) return NextResponse.json({ error: "Token invalide" }, { status: 401 })

    const response = NextResponse.json({
      user: { id: authUser.sub, email: authUser.email, name: authUser.name, role: authUser.role, deviceId: "web", token: idToken, orgId: authUser.orgId },
      org: { id: authUser.orgId, name: authUser.orgId === "demo-org" ? "Organisation Démo" : "" },
    })
    response.headers.set("Set-Cookie", setSessionCookie(idToken))
    return response
  } catch (error: any) {
    if (error?.name === "NotAuthorizedException") {
      return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 })
    }
    if (error?.name === "UserNotFoundException") {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 401 })
    }
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }
}
