"use client"

export type InvalidationTopic = "workflows" | "records" | "review" | "conflicts" | "sync" | "inventory"

const EVENT_NAME = "fieldflow:invalidate"

export function invalidate(topics: InvalidationTopic | InvalidationTopic[]) {
  if (typeof window === "undefined") return
  const list = Array.isArray(topics) ? topics : [topics]
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: list }))
}

export function onInvalidation(topics: InvalidationTopic[], callback: () => void) {
  if (typeof window === "undefined") return () => {}
  const wanted = new Set(topics)
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<InvalidationTopic[]>).detail
    if (!Array.isArray(detail) || detail.some((topic) => wanted.has(topic))) callback()
  }
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}
