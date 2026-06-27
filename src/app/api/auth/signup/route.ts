import { NextResponse } from "next/server"
import { CognitoIdentityProviderClient, SignUpCommand } from "@aws-sdk/client-cognito-identity-provider"
import { setSessionCookie } from "@/lib/auth/middleware"
import { dynamoStore } from "@/lib/api/dynamo-store"
import { getStore } from "@/lib/api/in-memory-store"
import { generateId } from "@/lib/utils"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const REGION = process.env.AWS_REGION || "us-east-1"

function getCognitoClient() {
  return new CognitoIdentityProviderClient({ region: REGION })
}

export async function POST(request: Request) {
  try {
    const { email, password, name, orgName, orgSector } = await request.json()
    if (!email || !password || !name || !orgName) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })
    }

    const cognito = getCognitoClient()
    const cognitoResult = await cognito.send(new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "name", Value: name },
        { Name: "custom:orgId", Value: "" },
        { Name: "custom:role", Value: "org_admin" },
      ],
    }))

    const orgId = generateId()
    const now = Date.now()
    const store = getStore()

    try {
      await dynamoStore.putOrgItem({
        pk: `ORG#${orgId}`, sk: "PROFILE",
        orgId, name: orgName, sector: orgSector || "other",
        plan: "free", createdAt: now,
        createdBy: cognitoResult.UserSub,
      })
    } catch {
      // DynamoDB not available — store in memory
    }

    store.putOrg({ id: orgId, name: orgName, sector: orgSector || "other", plan: "free", createdAt: now, createdBy: cognitoResult.UserSub || email })

    const userProfile = {
      pk: `USER#${cognitoResult.UserSub || email}`, sk: "PROFILE",
      userId: cognitoResult.UserSub || email, email, name,
      role: "org_admin", orgId, active: true, createdAt: now,
    }

    try {
      await dynamoStore.putOrgItem(userProfile)
    } catch {
      // DynamoDB not available
    }

    store.putUserProfile(userProfile)

    const dummyToken = `cognito-${orgId}-${cognitoResult.UserSub || email}`
    const response = NextResponse.json({
      success: true,
      orgId,
      redirect: `/org/${orgId}/admin/dashboard`,
    })
    response.headers.set("Set-Cookie", setSessionCookie(dummyToken))
    return response
  } catch (error: any) {
    if (error?.name === "UsernameExistsException") {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 })
    }
    return NextResponse.json({ error: "Erreur lors de l'inscription" }, { status: 500 })
  }
}
