import { NextResponse } from "next/server"
import { z } from "zod"
import { CognitoIdentityProviderClient, ConfirmForgotPasswordCommand } from "@aws-sdk/client-cognito-identity-provider"
import { checkRateLimit } from "@/lib/auth/rate-limit"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const REGION = process.env.AWS_REGION || "us-east-1"

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(12),
  password: z.string().min(8).max(128),
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

export async function POST(request: Request) {
  const rate = checkRateLimit(request, "auth-reset-password", 8, 15 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    )
  }

  const parsed = resetPasswordSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })

  try {
    await getCognitoClient().send(new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: parsed.data.email.trim().toLowerCase(),
      ConfirmationCode: parsed.data.code.trim(),
      Password: parsed.data.password,
    }))
  } catch (error) {
    console.error("[reset-password] Cognito failed", error instanceof Error ? error.name : error)
    return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}

