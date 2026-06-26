import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"

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
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  
  if (token && DEMO_TOKENS[token]) {
    const demo = DEMO_TOKENS[token]
    return { sub: token, email: `${token}@demo`, name: demo.name, role: demo.role, groups: [demo.role] }
  }
  
  const cookieToken = request.cookies.get("ff_session")?.value
  if (cookieToken && DEMO_TOKENS[cookieToken]) {
    const demo = DEMO_TOKENS[cookieToken]
    return { sub: cookieToken, email: `${cookieToken}@demo`, name: demo.name, role: demo.role, groups: [demo.role] }
  }
  
  return null
}

export function setSessionCookie(token: string, maxAge = 86400): string {
  return `ff_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export function clearSessionCookie(): string {
  return `ff_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}
