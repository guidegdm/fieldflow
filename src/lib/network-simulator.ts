export type NetworkMode = "online" | "offline" | "slow3g" | "flaky"

const STORAGE_KEY = "fieldflow-network-mode"
const modes: NetworkMode[] = ["online", "offline", "slow3g", "flaky"]

// Capture the real fetch lazily so this module is safe to import during SSR,
// where `window` is undefined.
const originalFetch: typeof fetch | null =
  typeof window !== "undefined" ? window.fetch.bind(window) : null
let currentMode: NetworkMode = readStoredMode()

function readStoredMode(): NetworkMode {
  if (typeof window === "undefined") return "online"
  const stored = window.sessionStorage.getItem(STORAGE_KEY)
  return modes.includes(stored as NetworkMode) ? stored as NetworkMode : "online"
}

export function getCurrentMode(): NetworkMode {
  currentMode = readStoredMode()
  return currentMode
}

export function simulateNetwork(mode: NetworkMode) {
  if (typeof window === "undefined" || !originalFetch) return
  currentMode = mode
  window.sessionStorage.setItem(STORAGE_KEY, mode)
  if (mode === "online") {
    window.fetch = originalFetch
    return
  }

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    if (mode === "offline") {
      throw new Error("Simulated offline")
    }
    if (mode === "slow3g") {
      await new Promise((r) => setTimeout(r, 2000))
      return originalFetch(...args)
    }
    if (mode === "flaky") {
      if (Math.random() < 0.3) {
        throw new Error("Simulated packet loss")
      }
    }
    return originalFetch(...args)
  }
}

export function restoreNetwork() {
  if (typeof window === "undefined" || !originalFetch) return
  currentMode = "online"
  window.sessionStorage.setItem(STORAGE_KEY, "online")
  window.fetch = originalFetch
}
