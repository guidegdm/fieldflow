self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS") return

  const urlsToCache = Array.isArray(event.data?.payload?.urlsToCache)
    ? event.data.payload.urlsToCache
    : []

  event.waitUntil((async () => {
    const cache = await caches.open("fieldflow-pages")
    await Promise.all(urlsToCache.map(async (entry) => {
      const [url, init] = Array.isArray(entry) ? entry : [entry, undefined]
      if (!url) return
      try {
        const request = new Request(url, {
          credentials: init?.credentials || "include",
          cache: "reload",
        })
        const response = await fetch(request)
        if (response?.ok) await cache.put(request, response.clone())
        if (response?.ok) await cache.put(url, response.clone())
      } catch {}
    }))
    event.ports?.[0]?.postMessage({ ok: true, cached: urlsToCache.length })
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

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const acceptsHtml = request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")
  if (!acceptsHtml) return

  event.stopImmediatePropagation()
  event.respondWith((async () => {
    const cache = await caches.open("fieldflow-pages")
    try {
      const response = await fetch(request)
      if (response?.ok) await cache.put(request, response.clone())
      if (response?.ok) await cache.put(request.url, response.clone())
      return response
    } catch {
      const exactUrl = new URL(request.url)
      const exact = await cache.match(request, { ignoreVary: true })
        || await cache.match(exactUrl.href, { ignoreVary: true })
        || await cache.match(exactUrl.pathname + exactUrl.search, { ignoreVary: true })
        || await cache.match(exactUrl.pathname, { ignoreSearch: true, ignoreVary: true })
      if (exact) return exact

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
