import { NextResponse } from "next/server"
import { z } from "zod"
import {
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  ResendConfirmationCodeCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { COGNITO_PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy"

const CLIENT_ID = process.env.COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const POOL_ID = process.env.COGNITO_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_POOL_ID || "us-east-1_kpjmcFVqD"

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().regex(COGNITO_PASSWORD_REQUIREMENT),
  name: z.string().trim().min(1).max(120),
  orgName: z.string().min(1).max(160),
  orgSector: z.string().min(1).max(80).optional(),
})

function getCognitoClient() {
  return new CognitoIdentityProviderClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  })
}

function authError(errorCode: string, status = 400) {
  return NextResponse.json({ errorCode, error: errorCode }, { status })
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
        return authError("password_policy", 400)
      }
      return authError("invalid_request", 400)
    }

    const { email, password, name } = parsed.data

    let delivery = null
    try {
      const cognito = getCognitoClient()
      const result = await cognito.send(new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "name", Value: name },
          { Name: "custom:role", Value: "org_admin" },
        ],
      }))
      delivery = result.CodeDeliveryDetails ?? null
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "UsernameExistsException") {
        const cognito = getCognitoClient()
        try {
          const user = await cognito.send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: email }))
          if (user.UserStatus === "UNCONFIRMED") {
            const resent = await cognito.send(new ResendConfirmationCodeCommand({ ClientId: CLIENT_ID, Username: email }))
            return NextResponse.json({
              success: true,
              requiresConfirmation: true,
              email,
              resent: true,
              delivery: resent.CodeDeliveryDetails ?? null,
              message: "Verification code resent",
            })
          }
        } catch (lookupError) {
          console.error("[signup] existing user lookup/resend failed", lookupError instanceof Error ? lookupError.name : "UnknownError")
        }
        return authError("email_exists", 409)
      }
      if (err instanceof Error && err.name === "InvalidPasswordException") {
        return authError("password_policy", 400)
      }
      if (err instanceof Error && err.name === "InvalidParameterException") {
        return authError("invalid_parameters", 400)
      }
      if (err instanceof Error && err.name === "LimitExceededException") {
        return authError("rate_limited", 429)
      }
      console.error("[signup] Cognito signup failed:", err instanceof Error ? err.name : "UnknownError")
      return authError("verification_delivery_failed", 503)
    }

    return NextResponse.json({
      success: true,
      requiresConfirmation: true,
      email,
      delivery,
      message: "Verification code sent",
    })
  } catch (error) {
    console.error("[signup] unexpected failure", error)
    return authError("signup_failed", 500)
  }
}
