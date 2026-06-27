interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function clientKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = forwarded || request.headers.get("x-real-ip") || "local"
  return `${scope}:${ip}`
}

export function checkRateLimit(request: Request, scope: string, limit: number, windowMs: number) {
  const now = Date.now()
  const key = clientKey(request, scope)
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  if (current.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) }
  }

  current.count += 1
  return { allowed: true, retryAfter: 0 }
}
