import { NextResponse } from "next/server"
import { z } from "zod"
import { CognitoIdentityProviderClient, ForgotPasswordCommand } from "@aws-sdk/client-cognito-identity-provider"
import { checkRateLimit } from "@/lib/auth/rate-limit"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const REGION = process.env.AWS_REGION || "us-east-1"

const forgotPasswordSchema = z.object({
  email: z.string().email(),
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
  const rate = checkRateLimit(request, "auth-forgot-password", 5, 15 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    )
  }

  const parsed = forgotPasswordSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide" }, { status: 400 })

  try {
    await getCognitoClient().send(new ForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: parsed.data.email.trim().toLowerCase(),
    }))
  } catch (error) {
    if (error instanceof Error && error.name === "UserNotFoundException") {
      return NextResponse.json({ success: true })
    }
    console.error("[forgot-password] Cognito failed", error)
    return NextResponse.json({ error: "Impossible d'envoyer le code" }, { status: 503 })
  }

  return NextResponse.json({ success: true })
}

