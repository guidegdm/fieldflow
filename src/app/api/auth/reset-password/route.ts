import { NextResponse } from "next/server"
import { z } from "zod"
import { CognitoIdentityProviderClient, ConfirmForgotPasswordCommand } from "@aws-sdk/client-cognito-identity-provider"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { COGNITO_PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const REGION = process.env.AWS_REGION || "us-east-1"

const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().min(4).max(12),
  password: z.string().regex(COGNITO_PASSWORD_REQUIREMENT),
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
  const rate = checkRateLimit(request, "auth-reset-password", 8, 15 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    )
  }

  const body = await request.json()
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    if (typeof body?.password === "string" && !COGNITO_PASSWORD_REQUIREMENT.test(body.password)) {
      return NextResponse.json({ error: passwordPolicyError }, { status: 400 })
    }
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  try {
    await getCognitoClient().send(new ConfirmForgotPasswordCommand({
      ClientId: CLIENT_ID,
      Username: parsed.data.email,
      ConfirmationCode: parsed.data.code.trim(),
      Password: parsed.data.password,
    }))
  } catch (error) {
    const errorName = error instanceof Error ? error.name : ""
    console.error("[reset-password] Cognito failed", errorName || error)
    if (errorName === "InvalidPasswordException") {
      return NextResponse.json({ error: passwordPolicyError }, { status: 400 })
    }
    if (errorName === "LimitExceededException") {
      return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 })
    }
    return NextResponse.json({ error: "Code invalide ou expiré" }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}
