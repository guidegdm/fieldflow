import { NextResponse } from "next/server"
import { z } from "zod"
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminResetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { checkRateLimit } from "@/lib/auth/rate-limit"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const POOL_ID = process.env.COGNITO_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_POOL_ID || "us-east-1_kpjmcFVqD"
const REGION = process.env.AWS_REGION || "us-east-1"

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
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
    const cognito = getCognitoClient()
    const username = parsed.data.email
    const user = await cognito.send(new AdminGetUserCommand({
      UserPoolId: POOL_ID,
      Username: username,
    })).catch((error) => {
      if (error instanceof Error && error.name === "UserNotFoundException") return null
      throw error
    })

    if (!user) return NextResponse.json({ success: true })

    if (user.UserStatus === "FORCE_CHANGE_PASSWORD") {
      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: POOL_ID,
        Username: username,
        MessageAction: "RESEND",
        DesiredDeliveryMediums: ["EMAIL"],
      }))
      return NextResponse.json({ success: true, mode: "temporary_password" })
    }

    if (user.UserStatus === "RESET_REQUIRED") {
      await cognito.send(new AdminResetUserPasswordCommand({
        UserPoolId: POOL_ID,
        Username: username,
      }))
    } else {
      await cognito.send(new ForgotPasswordCommand({
        ClientId: CLIENT_ID,
        Username: username,
      }))
    }
  } catch (error) {
    if (error instanceof Error && error.name === "UserNotFoundException") {
      return NextResponse.json({ success: true })
    }
    if (error instanceof Error && error.name === "LimitExceededException") {
      return NextResponse.json({ error: "Trop de demandes. Réessayez plus tard." }, { status: 429 })
    }
    if (error instanceof Error && error.name === "InvalidParameterException") {
      return NextResponse.json({ error: "Aucune adresse email vérifiée n'est disponible pour ce compte." }, { status: 400 })
    }
    console.error("[forgot-password] Cognito failed", error)
    return NextResponse.json({ error: "Impossible d'envoyer le code" }, { status: 503 })
  }

  return NextResponse.json({ success: true })
}
