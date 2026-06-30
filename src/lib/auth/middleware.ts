import { NextResponse, type NextRequest } from "next/server"
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

const COGNITO_POOL_ID = process.env.COGNITO_POOL_ID || process.env.NEXT_PUBLIC_COGNITO_POOL_ID || "us-east-1_kpjmcFVqD"
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "7r60o7fnej4vitoksrp6e93n9g"
const COGNITO_REGION = COGNITO_POOL_ID.split("_")[0] || "us-east-1"
const COGNITO_ISSUER = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_POOL_ID}`
const DEMO_INSTALL_COOKIE = "ff_demo_install"
const PENDING_SETUP_COOKIE = "ff_pending_setup"
const DEMO_INSTALL_MAX_AGE = 7 * 24 * 60 * 60
const PENDING_SETUP_MAX_AGE = 30 * 60
const DEV_SESSION_SECRET = process.env.NODE_ENV === "production" ? "" : "fieldflow-local-dev-session-secret"

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || DEV_SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET is required in production")
  return secret
}

let cachedKeys: Array<{ kid: string; n: string; e: string; kty: string }> = []
let keysLastFetched = 0

async function getCognitoPublicKeys(): Promise<Array<{ kid: string; n: string; e: string; kty: string }>> {
  if (Date.now() - keysLastFetched < 3600000 && cachedKeys.length > 0) return cachedKeys
  try {
    const url = `${COGNITO_ISSUER}/.well-known/jwks.json`
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
    const sig = Uint8Array.from(sigBytes).buffer
    const data = Uint8Array.from(dataBytes).buffer
    return subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, sig, data)
  } catch { return false }
}

interface AuthUser {
  sub: string
  email: string
  name: string
  role: string
  groups: string[]
  orgId: string
  orgs?: Array<{ id: string; name?: string }>
}

export interface PendingSetupUser {
  sub: string
  email: string
  name: string
  username: string
}

export async function verifyCognitoJWT(token: string, context?: Partial<AuthUser>): Promise<AuthUser | null> {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])))
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])))

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && now > payload.exp) return null
    if (payload.iat && Number(payload.iat) > now + 300) return null
    if (payload.iss !== COGNITO_ISSUER) return null
    if (payload.token_use !== "access" && payload.token_use !== "id") return null
    if (payload.token_use === "id" && payload.aud !== COGNITO_CLIENT_ID) return null
    if (payload.token_use === "access" && payload.client_id !== COGNITO_CLIENT_ID) return null

    if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) return null
    const keys = await getCognitoPublicKeys()
    if (keys.length === 0) return null
    const key = keys.find((k) => k.kid === header.kid)
    if (!key) return null
    const signingInput = `${parts[0]}.${parts[1]}`
    const valid = await verifyRS256Signature(signingInput, parts[2], key)
    if (!valid) return null

    const tokenOrgId = payload["custom:orgId"] as string | undefined
    const contextOrgAllowed = !!context?.orgId && (
      !context.orgs?.length || context.orgs.some((org) => org.id === context.orgId)
    )
    const orgId = (contextOrgAllowed ? context?.orgId : tokenOrgId || context?.orgId) || ""

    return {
      sub: (payload.sub as string) || token,
      email: (payload.email as string) || context?.email || "",
      name: (payload.name as string) || (payload.email as string) || context?.name || "",
      role: (payload["custom:role"] as string) || context?.role || "field_worker",
      groups: (payload["cognito:groups"] as string[]) || context?.groups || ["field_worker"],
      orgId,
      orgs: context?.orgs ?? (orgId ? [{ id: orgId, name: "" }] : []),
    }
  } catch { return null }
}

const sessionTokens = new Map<string, AuthUser>()

export function registerSessionToken(token: string, user: AuthUser) {
  sessionTokens.set(token, user)
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url")
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8")
}

function signSessionPayload(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url")
}

export function createSessionToken(user: AuthUser, maxAgeSeconds = 86400): string {
  const payload = encodeBase64Url(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds }))
  const signature = signSessionPayload(payload)
  return `session-${payload}.${signature}`
}

function verifySessionToken(token: string): AuthUser | null {
  if (!token.startsWith("session-")) return null
  const raw = token.slice("session-".length)
  const [payload, signature] = raw.split(".")
  if (!payload || !signature) return null

  const expected = signSessionPayload(payload)
  const givenBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (givenBytes.length !== expectedBytes.length || !timingSafeEqual(givenBytes, expectedBytes)) return null

  const decoded = JSON.parse(decodeBase64Url(payload)) as AuthUser & { exp?: number }
  if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) return null
  return {
    sub: decoded.sub,
    email: decoded.email,
    name: decoded.name,
    role: decoded.role,
    groups: decoded.groups,
    orgId: decoded.orgId,
    orgs: decoded.orgs,
  }
}

export function verifySessionContextToken(token: string): AuthUser | null {
  return verifySessionToken(token)
}

function createSignedEnvelope(data: Record<string, unknown>, maxAgeSeconds: number): string {
  const payload = encodeBase64Url(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + maxAgeSeconds }))
  return `${payload}.${signSessionPayload(payload)}`
}

function verifySignedEnvelope(token: string): Record<string, unknown> | null {
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null

  const expected = signSessionPayload(payload)
  const givenBytes = Buffer.from(signature)
  const expectedBytes = Buffer.from(expected)
  if (givenBytes.length !== expectedBytes.length || !timingSafeEqual(givenBytes, expectedBytes)) return null

  const decoded = JSON.parse(decodeBase64Url(payload)) as Record<string, unknown> & { exp?: number }
  if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) return null
  return decoded
}

export function createPendingSetupToken(user: PendingSetupUser, maxAgeSeconds = PENDING_SETUP_MAX_AGE): string {
  return createSignedEnvelope({ ...user, type: "pending_setup" }, maxAgeSeconds)
}

export function verifyPendingSetupToken(token: string): PendingSetupUser | null {
  const decoded = verifySignedEnvelope(token)
  if (decoded?.type !== "pending_setup") return null
  const sub = typeof decoded.sub === "string" ? decoded.sub : ""
  const email = typeof decoded.email === "string" ? decoded.email : ""
  const name = typeof decoded.name === "string" ? decoded.name : email
  const username = typeof decoded.username === "string" ? decoded.username : email
  if (!sub || !email || !username) return null
  return { sub, email, name, username }
}

export function getOrCreateDemoInstall(request: NextRequest): { installId: string; token: string; isNew: boolean } {
  const existing = request.cookies.get(DEMO_INSTALL_COOKIE)?.value
  if (existing) {
    const decoded = verifySignedEnvelope(existing)
    if (typeof decoded?.installId === "string") {
      return { installId: decoded.installId, token: existing, isNew: false }
    }
  }

  const installId = randomUUID().replace(/-/g, "")
  const token = createSignedEnvelope({ installId, type: "demo_install" }, DEMO_INSTALL_MAX_AGE)
  return { installId, token, isNew: true }
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const contextToken = request.cookies.get("ff_session")?.value
  let contextUser = contextToken ? verifySessionToken(contextToken) : null
  const middlewareOrgId = request.headers.get("x-fieldflow-org-id")
  if (contextUser && middlewareOrgId) {
    const allowed = !contextUser.orgs?.length || contextUser.orgs.some((org) => org.id === middlewareOrgId)
    if (allowed) contextUser = { ...contextUser, orgId: middlewareOrgId }
  }

  const accessToken = request.cookies.get("ff_access")?.value
  if (accessToken) {
    const user = await verifyCognitoJWT(accessToken, contextUser ?? undefined)
    if (user) return user
  }

  const cookieToken = request.cookies.get("ff_session")?.value
  if (cookieToken) {
    const signedSessionUser = verifySessionToken(cookieToken)
    if (signedSessionUser) return signedSessionUser

    const sessionUser = sessionTokens.get(cookieToken)
    if (sessionUser) return sessionUser

    if (!cookieToken.startsWith("demo-") && !cookieToken.startsWith("session-")) {
      const user = await verifyCognitoJWT(cookieToken)
      if (user) return user
    }
  }

  const authHeader = request.headers.get("authorization")
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (bearerToken) {
    const signedSessionUser = verifySessionToken(bearerToken)
    if (signedSessionUser) return signedSessionUser

    const user = await verifyCognitoJWT(bearerToken)
    if (user) return user
  }

  return null
}

export function setSessionCookie(token: string, maxAge = 86400): string {
  return `ff_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export function setAccessCookie(token: string, maxAge = 3600): string {
  return `ff_access=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export function setRefreshCookie(token: string, maxAge = 30 * 24 * 60 * 60): string {
  return `ff_refresh=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

export function setDemoInstallCookie(token: string): string {
  return `${DEMO_INSTALL_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${DEMO_INSTALL_MAX_AGE}`
}

export function setPendingSetupCookie(token: string): string {
  return `${PENDING_SETUP_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${PENDING_SETUP_MAX_AGE}`
}

export function clearSessionCookie(): string {
  return `ff_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

export function clearAccessCookie(): string {
  return `ff_access=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

export function clearRefreshCookie(): string {
  return `ff_refresh=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

export function clearPendingSetupCookie(): string {
  return `${PENDING_SETUP_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}
