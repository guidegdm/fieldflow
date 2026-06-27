import { NextRequest, NextResponse } from "next/server"
import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider"
import { createSessionToken, setAccessCookie, setSessionCookie, verifyCognitoJWT, verifySessionContextToken } from "@/lib/auth/middleware"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const REGION = process.env.AWS_REGION || "us-east-1"

function getCognitoClient() {
  return new CognitoIdentityProviderClient({ region: REGION })
}

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("ff_refresh")?.value
  if (!refreshToken) return NextResponse.json({ error: "Refresh token missing" }, { status: 401 })

  try {
    const result = await getCognitoClient().send(new InitiateAuthCommand({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    }))

    const accessToken = result.AuthenticationResult?.AccessToken
    const idToken = result.AuthenticationResult?.IdToken
    if (!accessToken) return NextResponse.json({ error: "Refresh failed" }, { status: 401 })

    const response = NextResponse.json({ success: true })
    response.headers.set("Set-Cookie", setAccessCookie(accessToken, 3600))

    if (idToken) {
      const contextCookie = request.cookies.get("ff_session")?.value
      const contextUser = contextCookie ? verifySessionContextToken(contextCookie) : null
      const authUser = await verifyCognitoJWT(idToken, contextUser ?? undefined)
      if (authUser) response.headers.append("Set-Cookie", setSessionCookie(createSessionToken(authUser, 3600), 3600))
    }

    return response
  } catch {
    return NextResponse.json({ error: "Refresh failed" }, { status: 401 })
  }
}
