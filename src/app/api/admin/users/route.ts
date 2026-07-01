import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"
import type { UserRole } from "@/types/auth"
import { generateId } from "@/lib/utils"

const POOL_ID = process.env.COGNITO_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_POOL_ID || "us-east-1_kpjmcFVqD"
const REGION = process.env.AWS_REGION || "us-east-1"

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["field_worker", "supervisor", "org_admin"]),
  name: z.string().min(1).max(120).optional(),
})

const updateUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["field_worker", "supervisor", "org_admin"]).optional(),
  active: z.boolean().optional(),
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

async function findCognitoUserByEmail(cognito: CognitoIdentityProviderClient, email: string) {
  const result = await cognito.send(new ListUsersCommand({
    UserPoolId: POOL_ID,
    Filter: `email = "${email.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`,
    Limit: 1,
  }))
  return result.Users?.[0]
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
  const inviteExpiresAt = now + 14 * 24 * 60 * 60 * 1000
  const store = getStore()
  const existingProfiles = await store.listUserProfilesByEmailAsync(email)
  const existingInWorkspace = existingProfiles.find((profile) => profile?.orgId === user.orgId)
  const demoInvite = user.orgId.startsWith("demo-") || email.endsWith("@demo.ff")
  const cognito = demoInvite ? null : getCognitoClient()
  let delivery: "existing_account_linked" | "invite_email_sent" | "profile_only" | "demo_profile_only" = demoInvite ? "demo_profile_only" : "profile_only"
  let deliveryWarning: string | undefined

  if (cognito) {
    try {
      const existing = await findCognitoUserByEmail(cognito, email)
      if (existing || existingProfiles.length > 0) {
        const username = existing?.Username
        if (username) {
          await cognito.send(new AdminUpdateUserAttributesCommand({
            UserPoolId: POOL_ID,
            Username: username,
            UserAttributes: [
              { Name: "name", Value: name },
            ],
          }))
        }
        delivery = "existing_account_linked"
      } else {
        await cognito.send(new AdminCreateUserCommand({
          UserPoolId: POOL_ID,
          Username: email,
          DesiredDeliveryMediums: ["EMAIL"],
          UserAttributes: [
            { Name: "email", Value: email },
            { Name: "email_verified", Value: "true" },
            { Name: "name", Value: name },
          ],
        }))
        delivery = "invite_email_sent"
      }
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError"
      deliveryWarning = errorName
      console.warn("[admin/users] Cognito invite delivery skipped; workspace profile will still be linked", errorName)
    }
  }

  const row = {
    ...(existingInWorkspace ?? {}),
    userId: existingInWorkspace?.userId || email,
    id: existingInWorkspace?.id || existingInWorkspace?.userId || email,
    email,
    name,
    role,
    orgId: user.orgId,
    active: existingInWorkspace?.active === true ? true : false,
    invited: existingInWorkspace?.active === true ? Boolean(existingInWorkspace?.invited) : true,
    inviteToken: existingInWorkspace?.inviteToken || generateId(),
    inviteStatus: existingInWorkspace?.active === true ? existingInWorkspace?.inviteStatus || "accepted" : "pending",
    inviteExpiresAt: existingInWorkspace?.active === true ? existingInWorkspace?.inviteExpiresAt : inviteExpiresAt,
    invitedBy: existingInWorkspace?.invitedBy || user.email,
    delivery,
    deliveryWarning,
    createdAt: existingInWorkspace?.createdAt || now,
    updatedAt: now,
  }

  await store.putUserProfileAsync(row)
  return NextResponse.json(row, { status: existingInWorkspace ? 200 : 201 })
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  if (user.role !== "org_admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const parsed = updateUserSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })

  const email = parsed.data.email.trim().toLowerCase()
  const store = getStore()
  const profiles = await store.listUserProfilesByEmailAsync(email)
  const profile = profiles.find((candidate) => candidate?.orgId === user.orgId)
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const active = parsed.data.active ?? Boolean(profile.active)
  const updated = {
    ...profile,
    email,
    role: parsed.data.role ?? profile.role,
    active,
    inviteStatus: active ? "accepted" : profile.inviteStatus === "pending" ? "pending" : "inactive",
    invited: active ? Boolean(profile.invited) : profile.invited,
    updatedAt: Date.now(),
  }

  await store.putUserProfileAsync(updated)
  return NextResponse.json(updated)
}
