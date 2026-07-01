import { NextRequest, NextResponse } from "next/server"
import {
  CognitoIdentityProviderClient,
  CompleteWebAuthnRegistrationCommand,
  ListWebAuthnCredentialsCommand,
  StartWebAuthnRegistrationCommand,
} from "@aws-sdk/client-cognito-identity-provider"
import type { DocumentType } from "@smithy/types"

const REGION = process.env.AWS_REGION || "us-east-1"

function getAccessToken(request: NextRequest) {
  return request.cookies.get("ff_access")?.value
}

function getCognitoClient() {
  return new CognitoIdentityProviderClient({
    region: REGION,
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  })
}

function webAuthnUnavailable(error: unknown) {
  return error instanceof Error && (
    error.name === "WebAuthnNotEnabledException"
    || error.name === "WebAuthnConfigurationMissingException"
  )
}

export async function GET(request: NextRequest) {
  const accessToken = getAccessToken(request)
  if (!accessToken) return NextResponse.json({ available: false, registered: false }, { status: 401 })

  try {
    const response = await getCognitoClient().send(new ListWebAuthnCredentialsCommand({
      AccessToken: accessToken,
      MaxResults: 10,
    }))
    return NextResponse.json({
      available: true,
      registered: Boolean(response.Credentials?.length),
      count: response.Credentials?.length ?? 0,
    })
  } catch (error) {
    if (webAuthnUnavailable(error)) return NextResponse.json({ available: false, registered: false })
    console.error("[passkey] status failed", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ available: false, registered: false }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const accessToken = getAccessToken(request)
  if (!accessToken) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { action?: string; credential?: unknown }
  try {
    if (body.action === "start") {
      const response = await getCognitoClient().send(new StartWebAuthnRegistrationCommand({ AccessToken: accessToken }))
      return NextResponse.json({ options: response.CredentialCreationOptions })
    }

    if (body.action === "complete") {
      await getCognitoClient().send(new CompleteWebAuthnRegistrationCommand({
        AccessToken: accessToken,
        Credential: body.credential as DocumentType,
      }))
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    if (webAuthnUnavailable(error)) return NextResponse.json({ error: "Passkeys are not enabled" }, { status: 409 })
    console.error("[passkey] registration failed", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ error: "Passkey registration failed" }, { status: 503 })
  }

  return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
}
