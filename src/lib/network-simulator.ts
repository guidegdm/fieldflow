export type NetworkMode = "online" | "offline" | "slow3g" | "flaky"

const originalFetch = window.fetch
let currentMode: NetworkMode = "online"

export function getCurrentMode(): NetworkMode {
  return currentMode
}

export function simulateNetwork(mode: NetworkMode) {
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
  currentMode = "online"
  window.fetch = originalFetch
}
