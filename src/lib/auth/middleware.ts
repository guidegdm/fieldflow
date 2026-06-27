import { NextResponse, type NextRequest } from "next/server"

const DEMO_TOKENS: Record<string, { role: string; name: string }> = {
  "demo-token-jp": { role: "field_worker", name: "Jean-Pierre" },
  "demo-token-fatima": { role: "field_worker", name: "Fatima" },
  "demo-token-amara": { role: "supervisor", name: "Dr. Amara" },
  "demo-token-celine": { role: "org_admin", name: "Celine" },
}

export interface AuthUser {
  sub: string
  email: string
  name: string
  role: string
  groups: string[]
  orgId: string
}

export function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"))
    return payload
  } catch {
    return null
  }
}

export function verifyCognitoToken(token: string): Promise<AuthUser | null> {
  const payload = decodeJWT(token)
  if (!payload) return Promise.resolve(null)

  const exp = payload.exp as number | undefined
  if (exp && Date.now() / 1000 > exp) return Promise.resolve(null)

  const orgId = (payload["custom:orgId"] as string) || "demo-org"
  const role = (payload["custom:role"] as string) || "field_worker"
  const groups = (payload["cognito:groups"] as string[]) || [role]

  return Promise.resolve({
    sub: (payload.sub as string) || token,
    email: (payload.email as string) || "",
    name: (payload.name as string) || (payload.email as string) || "",
    role,
    groups,
    orgId,
  })
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const cookieToken = request.cookies.get("ff_session")?.value
  if (cookieToken) {
    if (!cookieToken.startsWith("demo-")) {
      const cognitoUser = await verifyCognitoToken(cookieToken)
      if (cognitoUser) return cognitoUser
    }

    const demo = DEMO_TOKENS[cookieToken]
    if (demo) return { sub: cookieToken, email: `${cookieToken}@demo`, name: demo.name, role: demo.role, groups: [demo.role], orgId: "demo-org" }
  }

  const authHeader = request.headers.get("authorization")
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (bearerToken) {
    const cognitoUser = await verifyCognitoToken(bearerToken)
    if (cognitoUser) return cognitoUser

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
