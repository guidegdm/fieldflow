import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"
import type { UserRole } from "@/types/auth"

const POOL_ID = process.env.COGNITO_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_POOL_ID || "us-east-1_kpjmcFVqD"
const REGION = process.env.AWS_REGION || "us-east-1"

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["field_worker", "supervisor", "org_admin"]),
  name: z.string().min(1).max(120).optional(),
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

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  if (user.role !== "org_admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const users = await getStore().getUsersByOrg(user.orgId)
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  if (user.role !== "org_admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const parsed = inviteSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })

  const email = parsed.data.email.trim().toLowerCase()
  const role = parsed.data.role as UserRole
  const name = parsed.data.name?.trim() || email.split("@")[0]
  const now = Date.now()
  const store = getStore()
  const cognito = getCognitoClient()
  let delivery: "linked" | "invite_email_sent" | "profile_only" = "profile_only"

  try {
    try {
      await cognito.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: email }))
      await cognito.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: "name", Value: name },
          { Name: "custom:orgId", Value: user.orgId },
          { Name: "custom:role", Value: role },
        ],
      }))
      delivery = "linked"
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "UserNotFoundException") throw error
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: POOL_ID,
        Username: email,
        DesiredDeliveryMediums: ["EMAIL"],
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
          { Name: "name", Value: name },
          { Name: "custom:orgId", Value: user.orgId },
          { Name: "custom:role", Value: role },
        ],
      }))
      delivery = "invite_email_sent"
    }
  } catch (error) {
    console.error("[admin/users] cognito invite failed", error)
    return NextResponse.json({ error: "Invitation Cognito impossible" }, { status: 502 })
  }

  const row = {
    userId: email,
    id: email,
    email,
    name,
    role,
    orgId: user.orgId,
    active: true,
    invited: true,
    invitedBy: user.email,
    delivery,
    createdAt: now,
  }

  await store.putUserProfileAsync(row)
  return NextResponse.json(row, { status: 201 })
}
