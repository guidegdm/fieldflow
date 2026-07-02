self.FIELD_FLOW_CORE_ROUTES = [
  "/",
  "/demo",
  "/auth/signin",
  "/auth/signup",
  "/auth/setup",
  "/field-worker/home",
  "/field-worker/pick-workflow",
  "/field-worker/register",
  "/field-worker/search",
  "/supervisor/dashboard",
  "/supervisor/review",
  "/supervisor/inventory",
  "/admin/dashboard",
  "/admin/workflows",
  "/admin/workflows/new",
  "/admin/users",
]

const FIELD_FLOW_PAGE_CACHE_PREFIX = "fieldflow-pages"
const FIELD_FLOW_META_CACHE = "fieldflow-meta"
const FIELD_FLOW_ACTIVE_VERSION_REQUEST = "/__fieldflow_active_page_cache_version__"

function pageCacheName(version) {
  return version ? `${FIELD_FLOW_PAGE_CACHE_PREFIX}-${encodeURIComponent(version)}` : FIELD_FLOW_PAGE_CACHE_PREFIX
}

async function activePageCacheName() {
  const meta = await caches.open(FIELD_FLOW_META_CACHE)
  const response = await meta.match(FIELD_FLOW_ACTIVE_VERSION_REQUEST)
  const version = response ? await response.text() : ""
  return pageCacheName(version)
}

async function promotePageCacheVersion(version) {
  if (!version) return
  const meta = await caches.open(FIELD_FLOW_META_CACHE)
  await meta.put(FIELD_FLOW_ACTIVE_VERSION_REQUEST, new Response(version, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  }))
}

function isRscRequest(request) {
  const url = new URL(request.url)
  const accept = request.headers.get("accept") || ""
  return url.searchParams.has("_rsc") || request.headers.get("rsc") === "1" || accept.includes("text/x-component")
}

function isHtmlResponse(response) {
  const contentType = response?.headers?.get("content-type") || ""
  return Boolean(response?.ok && contentType.includes("text/html") && !contentType.includes("text/x-component"))
}

async function putPageResponse(cache, request, response) {
  if (!isHtmlResponse(response)) return false
  await cache.put(request, response.clone())
  await cache.put(request.url || String(request), response.clone())
  return true
}

async function purgeBadPageResponses() {
  const cache = await caches.open(await activePageCacheName())
  const requests = await cache.keys()
  await Promise.all(requests.map(async (request) => {
    const response = await cache.match(request)
    if (isRscRequest(request) || (response && !isHtmlResponse(response))) {
      await cache.delete(request)
    }
  }))
}

async function purgeOldPageCaches(activeName) {
  const names = await caches.keys()
  await Promise.all(names.map((name) => {
    if (!name.startsWith(`${FIELD_FLOW_PAGE_CACHE_PREFIX}-`) || name === activeName) return Promise.resolve(false)
    return caches.delete(name)
  }))
}

async function cachePageUrls(urlsToCache, options = {}) {
  const cacheName = pageCacheName(options.version)
  const cache = await caches.open(cacheName)
  let cached = 0
  let failed = 0
  await Promise.all(urlsToCache.map(async (entry) => {
    const [url, init] = Array.isArray(entry) ? entry : [entry, undefined]
    if (!url) return
    try {
      const request = new Request(url, {
        credentials: init?.credentials || "include",
        cache: "reload",
        headers: { Accept: "text/html,application/xhtml+xml" },
      })
      const response = await fetch(request)
      if (await putPageResponse(cache, request, response)) cached += 1
      else failed += 1
    } catch {
      failed += 1
    }
  }))
  const ok = failed === 0 || cached >= Math.min(3, urlsToCache.length)
  if (ok && options.promote && options.version) {
    await promotePageCacheVersion(options.version)
    await purgeOldPageCaches(cacheName)
  }
  return { ok, cached, failed, cacheName }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(purgeBadPageResponses())
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
    return
  }

  if (event.data?.type !== "CACHE_URLS") return

  const urlsToCache = Array.isArray(event.data?.payload?.urlsToCache)
    ? event.data.payload.urlsToCache
    : []

  event.waitUntil((async () => {
    const result = await cachePageUrls(urlsToCache, {
      version: typeof event.data?.payload?.version === "string" ? event.data.payload.version : "",
      promote: Boolean(event.data?.payload?.promote),
    })
    event.ports?.[0]?.postMessage(result)
  })())
})

self.addEventListener("notificationclick", (event) => {
  if (event.notification?.tag !== "fieldflow-install") return
  event.notification.close()
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const focused = clientsList.find((client) => "focus" in client)
    if (focused) return focused.focus()
    return self.clients.openWindow("/")
  })())
})

self.addEventListener("sync", (event) => {
  if (event.tag !== "fieldflow-sync") return

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    })
    await Promise.all(clientsList.map(async (client) => {
      client.postMessage({ type: "FIELD_FLOW_SYNC_NOW" })
    }))
  })())
})

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "fieldflow-maintenance") return

  event.waitUntil((async () => {
    await cachePageUrls(self.FIELD_FLOW_CORE_ROUTES.map((url) => [
      new URL(url, self.location.origin).href,
      { credentials: "include" },
    ]))

    const clientsList = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    })
    await Promise.all(clientsList.map(async (client) => {
      client.postMessage({ type: "FIELD_FLOW_SYNC_NOW" })
    }))
  })())
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  if (isRscRequest(request)) return

  const acceptsHtml = request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")
  if (!acceptsHtml) return

  event.stopImmediatePropagation()
  event.respondWith((async () => {
    const cache = await caches.open(await activePageCacheName())
    const exactUrl = new URL(request.url)
    const cached = await cache.match(request, { ignoreVary: true })
      || await cache.match(exactUrl.href, { ignoreVary: true })
      || await cache.match(exactUrl.pathname + exactUrl.search, { ignoreVary: true })
      || await cache.match(exactUrl.pathname, { ignoreSearch: true, ignoreVary: true })

    if (cached) {
      event.waitUntil(fetch(request).then(async (response) => {
        await putPageResponse(cache, request, response)
      }).catch(() => {}))
      return cached
    }

    try {
      const response = await fetch(request)
      await putPageResponse(cache, request, response)
      return response
    } catch {
      const fallbackUrls = [
        exactUrl.pathname.startsWith("/field-worker/record/") ? "/field-worker/home" : "",
        exactUrl.pathname.startsWith("/admin/workflows/") ? "/admin/workflows" : "",
        exactUrl.pathname.startsWith("/field-worker/") ? "/field-worker/home" : "",
        exactUrl.pathname.startsWith("/supervisor/") ? "/supervisor/dashboard" : "",
        exactUrl.pathname.startsWith("/admin/") ? "/admin/dashboard" : "",
        "/field-worker/home",
        "/field-worker/pick-workflow",
        "/field-worker/register",
        "/supervisor/dashboard",
        "/admin/dashboard",
        "/demo",
        "/",
      ]
      for (const url of fallbackUrls) {
        if (!url) continue
        const fallback = await cache.match(new URL(url, self.location.origin).href)
        if (fallback) return fallback
      }
      return new Response("FieldFlow is offline. Reopen the app once online to refresh the offline shell.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    }
  })())
})
