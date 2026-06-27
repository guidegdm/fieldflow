import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    { name: "chrome", use: { ...devices["Desktop Chrome"] } },
  ],
})
