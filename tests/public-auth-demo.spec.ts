import { mkdirSync } from "node:fs"
import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.BASE_URL || "http://localhost:3000"

const viewports = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const

function screenshotPath(viewport: string, slug: string) {
  return `tmp/screens/public-auth-demo-${viewport}-${slug}.png`
}

async function assertNoHorizontalOverflow(page: Page, route: string, viewport: string) {
  const issues = await page.evaluate(() => {
    const doc = document.documentElement
    const body = document.body
    const viewportWidth = doc.clientWidth
    const horizontalOverflow = Math.max(doc.scrollWidth, body.scrollWidth) - viewportWidth
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 1 && (rect.left < -1 || rect.right > viewportWidth + 1)
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName.toLowerCase(),
          text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
          className: String(element.className || "").slice(0, 160),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        }
      })

    return { horizontalOverflow, offenders }
  })

  expect(issues, JSON.stringify({ route, viewport, issues }, null, 2)).toEqual({
    horizontalOverflow: 0,
    offenders: [],
  })
}

async function setEnglish(page: Page) {
  const englishButton = page.getByRole("button", { name: /EN/i })
  if ((await englishButton.count()) > 0 && (await englishButton.first().getAttribute("aria-pressed")) !== "true") {
    await englishButton.first().click()
  }
}

async function setFrench(page: Page) {
  const frenchButton = page.getByRole("button", { name: /FR/i })
  if ((await frenchButton.count()) > 0 && (await frenchButton.first().getAttribute("aria-pressed")) !== "true") {
    await frenchButton.first().click()
  }
}

test.describe("public/auth/demo first impression flows", () => {
  test.beforeAll(() => {
    mkdirSync("tmp/screens", { recursive: true })
  })

  for (const viewport of viewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } })

      test("landing page buttons and language toggle", async ({ page }) => {
        await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" })

        await expect(page.getByRole("heading", { level: 1, name: /The field does not wait\./i })).toBeVisible()
        await expect(page.getByRole("link", { name: /Try the live demo/i })).toBeVisible()
        await expect(page.getByRole("link", { name: /Create workspace/i })).toBeVisible()

        const languageGroup = page.getByRole("group", { name: /Language|Langue/i })
        await expect(languageGroup).toBeVisible()

        await setEnglish(page)
        await expect(page.getByRole("button", { name: /EN/i }).first()).toHaveAttribute("aria-pressed", "true")

        await setFrench(page)
        await expect(page.getByRole("button", { name: /FR/i }).first()).toHaveAttribute("aria-pressed", "true")

        await page.screenshot({ path: screenshotPath(viewport.name, "landing"), fullPage: true })
        await assertNoHorizontalOverflow(page, "/", viewport.name)
      })

      test("sign in page controls and Google entry point", async ({ page }) => {
        await page.goto(`${baseUrl}/auth/signin`, { waitUntil: "networkidle" })

        await expect(page.getByRole("heading", { name: /Connexion|Sign in/i })).toBeVisible()
        await expect(page.getByLabel(/Adresse email|Email address/i)).toBeVisible()
        await expect(page.getByLabel(/Mot de passe|Password/i)).toBeVisible()
        await expect(page.getByRole("button", { name: /Continuer avec Google|Continue with Google/i })).toBeVisible()
        await expect(page.getByRole("button", { name: /Connexion sécurisée|Secure login/i })).toBeVisible()

        await setEnglish(page)
        await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible()

        await setFrench(page)
        await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible()

        await page.screenshot({ path: screenshotPath(viewport.name, "signin"), fullPage: true })
        await assertNoHorizontalOverflow(page, "/auth/signin", viewport.name)
      })

      test("signup validation and Google entry point", async ({ page }) => {
        await page.goto(`${baseUrl}/auth/signup`, { waitUntil: "networkidle" })

        await expect(page.getByRole("heading", { name: /Créer un compte|Create an account/i })).toBeVisible()
        await expect(page.getByRole("button", { name: /Continuer avec Google|Continue with Google/i })).toBeVisible()

        await setEnglish(page)
        await page.getByRole("button", { name: /Create my organization/i }).click()
        await expect(page.getByText("Required")).toHaveCount(4)

        await setFrench(page)
        await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible()

        await page.screenshot({ path: screenshotPath(viewport.name, "signup-validation"), fullPage: true })
        await assertNoHorizontalOverflow(page, "/auth/signup", viewport.name)
      })

      test("demo login reaches a real authenticated workspace", async ({ page }) => {
        await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" })

        await expect(page.getByText(/Demo accounts|Comptes de démonstration/i)).toBeVisible()
        await expect(page.getByRole("button", { name: /Céline|Celine/i })).toBeVisible()

        await page.getByRole("button", { name: /Céline|Celine/i }).click()
        await page.waitForURL(/\/admin\/dashboard/, { timeout: 30000 })

        await expect(page).toHaveURL(/\/admin\/dashboard/)
        await page.screenshot({ path: screenshotPath(viewport.name, "demo-admin-dashboard"), fullPage: true })
        await assertNoHorizontalOverflow(page, "/admin/dashboard", viewport.name)
      })
    })
  }
})
