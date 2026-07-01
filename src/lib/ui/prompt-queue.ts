"use client"

import { useEffect, useState } from "react"

const PROMPT_CHANGED = "fieldflow:prompt-queue-changed"
const GAP_MS = 1500

let activePrompt: string | null = null
let lastClosedAt = 0
const waiting = new Set<string>()

function emit() {
  window.dispatchEvent(new Event(PROMPT_CHANGED))
}

function promoteNext() {
  if (activePrompt || waiting.size === 0) return
  const delay = Math.max(0, GAP_MS - (Date.now() - lastClosedAt))
  window.setTimeout(() => {
    if (activePrompt || waiting.size === 0) return
    activePrompt = Array.from(waiting)[0]
    waiting.delete(activePrompt)
    emit()
  }, delay)
}

export function usePromptQueueSlot(id: string, requested: boolean) {
  const [, rerender] = useState(0)

  useEffect(() => {
    const onChange = () => rerender((value) => value + 1)
    window.addEventListener(PROMPT_CHANGED, onChange)
    return () => window.removeEventListener(PROMPT_CHANGED, onChange)
  }, [])

  useEffect(() => {
    if (!requested) {
      waiting.delete(id)
      if (activePrompt === id) {
        activePrompt = null
        lastClosedAt = Date.now()
        promoteNext()
        emit()
      }
      return
    }

    if (!activePrompt && Date.now() - lastClosedAt >= GAP_MS) {
      activePrompt = id
      emit()
      return
    }

    if (activePrompt !== id) {
      waiting.add(id)
      promoteNext()
      emit()
    }

    return () => {
      waiting.delete(id)
      if (activePrompt === id) {
        activePrompt = null
        lastClosedAt = Date.now()
        promoteNext()
        emit()
      }
    }
  }, [id, requested])

  const release = () => {
    waiting.delete(id)
    if (activePrompt === id) {
      activePrompt = null
      lastClosedAt = Date.now()
      promoteNext()
      emit()
    }
  }

  return { canShow: requested && activePrompt === id, release }
}
