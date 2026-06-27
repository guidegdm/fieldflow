# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-auth-demo.spec.ts >> public/auth/demo first impression flows >> phone >> landing page buttons and language toggle
- Location: tests\public-auth-demo.spec.ts:71:11

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
  - navigating to "http://localhost:3000/", waiting until "networkidle"

```

# Test source

```ts
  1   | import { mkdirSync } from "node:fs"
  2   | import { expect, test, type Page } from "@playwright/test"
  3   | 
  4   | const baseUrl = process.env.BASE_URL || "http://localhost:3000"
  5   | 
  6   | const viewports = [
  7   |   { name: "phone", width: 390, height: 844 },
  8   |   { name: "tablet", width: 768, height: 1024 },
  9   |   { name: "desktop", width: 1440, height: 900 },
  10  | ] as const
  11  | 
  12  | function screenshotPath(viewport: string, slug: string) {
  13  |   return `tmp/screens/public-auth-demo-${viewport}-${slug}.png`
  14  | }
  15  | 
  16  | async function assertNoHorizontalOverflow(page: Page, route: string, viewport: string) {
  17  |   const issues = await page.evaluate(() => {
  18  |     const doc = document.documentElement
  19  |     const body = document.body
  20  |     const viewportWidth = doc.clientWidth
  21  |     const horizontalOverflow = Math.max(doc.scrollWidth, body.scrollWidth) - viewportWidth
  22  |     const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
  23  |       .filter((element) => {
  24  |         const rect = element.getBoundingClientRect()
  25  |         return rect.width > 1 && (rect.left < -1 || rect.right > viewportWidth + 1)
  26  |       })
  27  |       .slice(0, 8)
  28  |       .map((element) => {
  29  |         const rect = element.getBoundingClientRect()
  30  |         return {
  31  |           tag: element.tagName.toLowerCase(),
  32  |           text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
  33  |           className: String(element.className || "").slice(0, 160),
  34  |           left: Math.round(rect.left),
  35  |           right: Math.round(rect.right),
  36  |         }
  37  |       })
  38  | 
  39  |     return { horizontalOverflow, offenders }
  40  |   })
  41  | 
  42  |   expect(issues, JSON.stringify({ route, viewport, issues }, null, 2)).toEqual({
  43  |     horizontalOverflow: 0,
  44  |     offenders: [],
  45  |   })
  46  | }
  47  | 
  48  | async function setEnglish(page: Page) {
  49  |   const englishButton = page.getByRole("button", { name: /EN/i })
  50  |   if ((await englishButton.count()) > 0 && (await englishButton.first().getAttribute("aria-pressed")) !== "true") {
  51  |     await englishButton.first().click()
  52  |   }
  53  | }
  54  | 
  55  | async function setFrench(page: Page) {
  56  |   const frenchButton = page.getByRole("button", { name: /FR/i })
  57  |   if ((await frenchButton.count()) > 0 && (await frenchButton.first().getAttribute("aria-pressed")) !== "true") {
  58  |     await frenchButton.first().click()
  59  |   }
  60  | }
  61  | 
  62  | test.describe("public/auth/demo first impression flows", () => {
  63  |   test.beforeAll(() => {
  64  |     mkdirSync("tmp/screens", { recursive: true })
  65  |   })
  66  | 
  67  |   for (const viewport of viewports) {
  68  |     test.describe(viewport.name, () => {
  69  |       test.use({ viewport: { width: viewport.width, height: viewport.height } })
  70  | 
  71  |       test("landing page buttons and language toggle", async ({ page }) => {
> 72  |         await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" })
      |                    ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
  73  | 
  74  |         await expect(page.getByRole("heading", { level: 1, name: /The field does not wait\./i })).toBeVisible()
  75  |         await expect(page.getByRole("link", { name: /Try the live demo/i })).toBeVisible()
  76  |         await expect(page.getByRole("link", { name: /Create workspace/i })).toBeVisible()
  77  | 
  78  |         const languageGroup = page.getByRole("group", { name: /Language|Langue/i })
  79  |         await expect(languageGroup).toBeVisible()
  80  | 
  81  |         await setEnglish(page)
  82  |         await expect(page.getByRole("button", { name: /EN/i }).first()).toHaveAttribute("aria-pressed", "true")
  83  | 
  84  |         await setFrench(page)
  85  |         await expect(page.getByRole("button", { name: /FR/i }).first()).toHaveAttribute("aria-pressed", "true")
  86  | 
  87  |         await page.screenshot({ path: screenshotPath(viewport.name, "landing"), fullPage: true })
  88  |         await assertNoHorizontalOverflow(page, "/", viewport.name)
  89  |       })
  90  | 
  91  |       test("sign in page controls and Google entry point", async ({ page }) => {
  92  |         await page.goto(`${baseUrl}/auth/signin`, { waitUntil: "networkidle" })
  93  | 
  94  |         await expect(page.getByRole("heading", { name: /Connexion|Sign in/i })).toBeVisible()
  95  |         await expect(page.getByLabel(/Adresse email|Email address/i)).toBeVisible()
  96  |         await expect(page.getByLabel(/Mot de passe|Password/i)).toBeVisible()
  97  |         await expect(page.getByRole("button", { name: /Continuer avec Google|Continue with Google/i })).toBeVisible()
  98  |         await expect(page.getByRole("button", { name: /Connexion sécurisée|Secure login/i })).toBeVisible()
  99  | 
  100 |         await setEnglish(page)
  101 |         await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible()
  102 | 
  103 |         await setFrench(page)
  104 |         await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible()
  105 | 
  106 |         await page.screenshot({ path: screenshotPath(viewport.name, "signin"), fullPage: true })
  107 |         await assertNoHorizontalOverflow(page, "/auth/signin", viewport.name)
  108 |       })
  109 | 
  110 |       test("signup validation and Google entry point", async ({ page }) => {
  111 |         await page.goto(`${baseUrl}/auth/signup`, { waitUntil: "networkidle" })
  112 | 
  113 |         await expect(page.getByRole("heading", { name: /Créer un compte|Create an account/i })).toBeVisible()
  114 |         await expect(page.getByRole("button", { name: /Continuer avec Google|Continue with Google/i })).toBeVisible()
  115 | 
  116 |         await setEnglish(page)
  117 |         await page.getByRole("button", { name: /Create my organization/i }).click()
  118 |         await expect(page.getByText("Required")).toHaveCount(4)
  119 | 
  120 |         await setFrench(page)
  121 |         await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible()
  122 | 
  123 |         await page.screenshot({ path: screenshotPath(viewport.name, "signup-validation"), fullPage: true })
  124 |         await assertNoHorizontalOverflow(page, "/auth/signup", viewport.name)
  125 |       })
  126 | 
  127 |       test("demo login reaches a real authenticated workspace", async ({ page }) => {
  128 |         await page.goto(`${baseUrl}/demo`, { waitUntil: "networkidle" })
  129 | 
  130 |         await expect(page.getByText(/Demo accounts|Comptes de démonstration/i)).toBeVisible()
  131 |         await expect(page.getByRole("button", { name: /Céline|Celine/i })).toBeVisible()
  132 | 
  133 |         await page.getByRole("button", { name: /Céline|Celine/i }).click()
  134 |         await page.waitForURL(/\/admin\/dashboard/, { timeout: 30000 })
  135 | 
  136 |         await expect(page).toHaveURL(/\/admin\/dashboard/)
  137 |         await page.screenshot({ path: screenshotPath(viewport.name, "demo-admin-dashboard"), fullPage: true })
  138 |         await assertNoHorizontalOverflow(page, "/admin/dashboard", viewport.name)
  139 |       })
  140 |     })
  141 |   }
  142 | })
  143 | 
```