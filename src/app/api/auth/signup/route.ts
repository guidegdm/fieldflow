import { NextResponse } from "next/server"
import { z } from "zod"
import { CognitoIdentityProviderClient, SignUpCommand } from "@aws-sdk/client-cognito-identity-provider"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { COGNITO_PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().regex(COGNITO_PASSWORD_REQUIREMENT),
  name: z.string().trim().min(1).max(120),
  orgName: z.string().min(1).max(160),
  orgSector: z.string().min(1).max(80).optional(),
})

const passwordPolicyError = "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un symbole."

function getCognitoClient() {
  return new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  })
}

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, "auth-signup", 3, 60 * 60_000)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Trop d'inscriptions. Réessayez plus tard." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      )
    }

    const body = await request.json()
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      if (typeof body?.password === "string" && !COGNITO_PASSWORD_REQUIREMENT.test(body.password)) {
        return NextResponse.json({ error: passwordPolicyError }, { status: 400 })
      }
      return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
    }

    const { email, password, name } = parsed.data

    try {
      const cognito = getCognitoClient()
      await cognito.send(new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "name", Value: name },
          { Name: "custom:role", Value: "org_admin" },
        ],
      }))
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "UsernameExistsException") {
        return NextResponse.json({ error: "Cet email est deja utilise" }, { status: 409 })
      }
      if (err instanceof Error && err.name === "InvalidPasswordException") {
        return NextResponse.json({ error: passwordPolicyError }, { status: 400 })
      }
      if (err instanceof Error && err.name === "InvalidParameterException") {
        return NextResponse.json({ error: "Vérifiez le nom, l'email et le mot de passe." }, { status: 400 })
      }
      if (err instanceof Error && err.name === "LimitExceededException") {
        return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 })
      }
      console.error("[signup] Cognito signup failed:", err instanceof Error ? err.name : "UnknownError")
      return NextResponse.json({ error: "Impossible d'envoyer le code de vérification" }, { status: 503 })
    }

    return NextResponse.json({
      success: true,
      requiresConfirmation: true,
      email,
      message: "Verification code sent",
    })
  } catch (error) {
    console.error("[signup] unexpected failure", error)
    return NextResponse.json({ error: "Erreur lors de l'inscription" }, { status: 500 })
  }
}
