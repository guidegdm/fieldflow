import { NextResponse, type NextRequest } from "next/server"

const COGNITO_POOL_ID = process.env.COGNITO_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_POOL_ID || "us-east-1_kpjmcFVqD"

const DEMO_TOKENS: Record<string, { role: string; name: string }> = {
  "demo-token-jp": { role: "field_worker", name: "Jean-Pierre" },
  "demo-token-fatima": { role: "field_worker", name: "Fatima" },
  "demo-token-amara": { role: "supervisor", name: "Dr. Amara" },
  "demo-token-celine": { role: "org_admin", name: "Celine" },
}

let cachedKeys: Array<{ kid: string; n: string; e: string; kty: string }> = []
let keysLastFetched = 0

async function getCognitoPublicKeys(): Promise<Array<{ kid: string; n: string; e: string; kty: string }>> {
  if (Date.now() - keysLastFetched < 3600000 && cachedKeys.length > 0) return cachedKeys
  try {
    const region = COGNITO_POOL_ID.split("_")[0] || "us-east-1"
    const url = `https://cognito-idp.${region}.amazonaws.com/${COGNITO_POOL_ID}/.well-known/jwks.json`
    const res = await fetch(url)
    const data = (await res.json()) as { keys: Array<{ kid: string; n: string; e: string; kty: string }> }
    cachedKeys = data.keys
    keysLastFetched = Date.now()
    return cachedKeys
  } catch { return [] }
}

function base64UrlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function base64UrlToBigInt(str: string): bigint {
  const bytes = base64UrlToBytes(str)
  let result = 0n
  for (let i = 0; i < bytes.length; i++) result = (result << 8n) | BigInt(bytes[i])
  return result
}

async function verifyRS256Signature(payload: string, signature: string, key: { n: string; e: string }): Promise<boolean> {
  try {
    const { subtle } = globalThis.crypto
    const keyData = {
      kty: "RSA", n: key.n, e: key.e,
      alg: "RS256", ext: true,
    }
    const cryptoKey = await subtle.importKey("jwk", keyData as unknown as JsonWebKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"])
    const sigBytes = base64UrlToBytes(signature)
    const dataBytes = new TextEncoder().encode(payload)
    return subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sigBytes, dataBytes)
  } catch { return false }
}

interface AuthUser {
  sub: string
  email: string
  name: string
  role: string
  groups: string[]
  orgId: string
}

export async function verifyCognitoJWT(token: string): Promise<AuthUser | null> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])))
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])))

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && now > payload.exp) return null
    if (payload.iss && !payload.iss.includes("cognito-idp")) return null
    if (payload.token_use && payload.token_use !== "access" && payload.token_use !== "id") return null

    if (header.alg === "RS256" && header.kid) {
      const keys = await getCognitoPublicKeys()
      const key = keys.find((k) => k.kid === header.kid)
      if (key) {
        const signingInput = `${parts[0]}.${parts[1]}`
        const valid = await verifyRS256Signature(signingInput, parts[2], key)
        if (!valid && keys.length > 0) return null
      }
    }

    return {
      sub: (payload.sub as string) || token,
      email: (payload.email as string) || "",
      name: (payload.name as string) || (payload.email as string) || "",
      role: (payload["custom:role"] as string) || "field_worker",
      groups: (payload["cognito:groups"] as string[]) || ["field_worker"],
      orgId: (payload["custom:orgId"] as string) || "demo-org",
    }
  } catch { return null }
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const cookieToken = request.cookies.get("ff_session")?.value
  if (cookieToken) {
    if (!cookieToken.startsWith("demo-")) {
      const user = await verifyCognitoJWT(cookieToken)
      if (user) return user
    }
    const demo = DEMO_TOKENS[cookieToken]
    if (demo) return { sub: cookieToken, email: `${cookieToken}@demo`, name: demo.name, role: demo.role, groups: [demo.role], orgId: "demo-org" }
  }

  const authHeader = request.headers.get("authorization")
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (bearerToken) {
    const user = await verifyCognitoJWT(bearerToken)
    if (user) return user
    const demo = DEMO_TOKENS[bearerToken]
    if (demo) return { sub: bearerToken, email: `${bearerToken}@demo`, name: demo.name, role: demo.role, groups: [demo.role], orgId: "demo-org" }
  }

  return null
}

export function setSessionCookie(token: string, maxAge = 86400): string {
  return `ff_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export function clearSessionCookie(): string {
  return `ff_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}
