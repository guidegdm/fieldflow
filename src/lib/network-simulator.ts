export type NetworkMode = "online" | "offline" | "slow3g" | "flaky"

// Capture the real fetch lazily so this module is safe to import during SSR,
// where `window` is undefined.
const originalFetch: typeof fetch | null =
  typeof window !== "undefined" ? window.fetch.bind(window) : null
let currentMode: NetworkMode = "online"

export function getCurrentMode(): NetworkMode {
  return currentMode
}

export function simulateNetwork(mode: NetworkMode) {
  if (typeof window === "undefined" || !originalFetch) return
  currentMode = mode
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
  window.fetch = originalFetch
}
