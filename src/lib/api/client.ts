const REQUEST_TIMEOUT_MS = 15000

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  let res = await fetchWithTimeout(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  })
  if (res.status === 401 && await refreshAuth()) {
    res = await fetchWithTimeout(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    })
  }
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`POST ${path} failed: ${res.status} ${err}`)
  }
  return res.json()
}

async function refreshAuth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout("/api/auth/refresh", { method: "POST", credentials: "include" })
    return res.ok
  } catch {
    return false
  }
}

export function getOrgIdFromPath(path: string): string | null {
  const match = path.match(/\/org\/([^/]+)/)
  return match ? match[1] : null
}

export async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  let url: string
  if (typeof window !== "undefined") {
    const u = new URL(path, window.location.origin)
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
    url = u.toString()
  } else {
    url = path
    if (params) {
      const qs = new URLSearchParams(params).toString()
      url += `?${qs}`
    }
  }

  let res = await fetchWithTimeout(url, { credentials: "include" })
  if (res.status === 401 && await refreshAuth()) {
    res = await fetchWithTimeout(url, { credentials: "include" })
  }
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GET ${path} failed: ${res.status} ${err}`)
  }
  return res.json()
}
