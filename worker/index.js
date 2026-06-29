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
      } catch {}
    }))
    event.ports?.[0]?.postMessage({ ok: true, cached: urlsToCache.length })
  })())
})
