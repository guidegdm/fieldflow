import { NextRequest, NextResponse } from "next/server"
import { AdminUpdateUserAttributesCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"
import { z } from "zod"
import {
  clearPendingSetupCookie,
  createSessionToken,
  setSessionCookie,
  verifyPendingSetupToken,
} from "@/lib/auth/middleware"
import { getStore } from "@/lib/api/in-memory-store"
import { generateId } from "@/lib/utils"

const POOL_ID = process.env.COGNITO_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_POOL_ID || "us-east-1_kpjmcFVqD"
const REGION = process.env.AWS_REGION || "us-east-1"

const setupSchema = z.object({
  orgName: z.string().min(1).max(160),
  orgSector: z.string().min(1).max(80),
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
  const pending = request.cookies.get("ff_pending_setup")?.value
  const user = pending ? verifyPendingSetupToken(pending) : null
  if (!user) return NextResponse.json({ error: "setup_required" }, { status: 401 })

  return NextResponse.json({
    user: {
      email: user.email,
      name: user.name,
    },
  })
}

export async function POST(request: NextRequest) {
  const pending = request.cookies.get("ff_pending_setup")?.value
  const pendingUser = pending ? verifyPendingSetupToken(pending) : null
  if (!pendingUser) return NextResponse.json({ error: "setup_required" }, { status: 401 })

  const parsed = setupSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 })

  const orgId = generateId()
  const now = Date.now()
  const { orgName, orgSector } = parsed.data
  const store = getStore()

  try {
    await store.putOrgAsync({
      id: orgId,
      name: orgName,
      sector: orgSector,
      createdAt: now,
      createdBy: pendingUser.email,
      authProvider: "google",
    })
    await store.putUserProfileAsync({
      userId: pendingUser.email,
      sub: pendingUser.sub,
      email: pendingUser.email,
      name: pendingUser.name,
      role: "org_admin",
      orgId,
      active: true,
      emailVerified: true,
      authProvider: "google",
      createdAt: now,
    })
  } catch (error) {
    console.error("[setup] store write failed", error)
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 })
  }

  try {
    await getCognitoClient().send(new AdminUpdateUserAttributesCommand({
      UserPoolId: POOL_ID,
      Username: pendingUser.username,
      UserAttributes: [
        { Name: "custom:role", Value: "org_admin" },
        { Name: "name", Value: pendingUser.name },
      ],
    }))
  } catch (error) {
    console.warn("[setup] Cognito attribute update failed", error instanceof Error ? error.name : "UnknownError")
  }

  const sessionToken = createSessionToken({
    sub: pendingUser.sub,
    email: pendingUser.email,
    name: pendingUser.name,
    role: "org_admin",
    groups: ["org_admin"],
    orgId,
    orgs: [{ id: orgId, name: orgName, role: "org_admin" }],
  }, 3600)

  const response = NextResponse.json({
    success: true,
    user: {
      id: pendingUser.sub,
      email: pendingUser.email,
      name: pendingUser.name,
      role: "org_admin",
      deviceId: "web",
      orgId,
    },
    org: { id: orgId, name: orgName, role: "org_admin" },
    orgs: [{ id: orgId, name: orgName, role: "org_admin" }],
    redirect: "/admin/dashboard",
  })
  response.headers.set("Set-Cookie", setSessionCookie(sessionToken, 3600))
  response.headers.append("Set-Cookie", clearPendingSetupCookie())
  return response
}
