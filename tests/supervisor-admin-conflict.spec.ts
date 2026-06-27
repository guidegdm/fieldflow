import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.BASE_URL || "http://localhost:3000"

async function gotoAndWait(page: Page, path: string) {
  try {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 })
  } catch (error) {
    if (!String(error).includes("ERR_ABORTED")) throw error
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 })
  }
  await page.locator("body").waitFor({ state: "visible" })
}

async function loginFromDemo(page: Page, personaName: RegExp, destinationPath: string) {
  await gotoAndWait(page, "/demo")
  await expect(page.getByText(/Demo accounts|Comptes de démonstration/i)).toBeVisible()
  await page.getByRole("button", { name: personaName }).first().click()
  await page.waitForURL(new RegExp(destinationPath.replace(/\//g, "\\/")), { timeout: 30000 })

  const session = await page.evaluate(async () => {
    const response = await fetch("/api/auth/session", { credentials: "include" })
    if (!response.ok) return null
    return response.json()
  })

  expect(session).not.toBeNull()

  await page.evaluate((value) => {
    window.localStorage.setItem("fieldflow-auth", JSON.stringify({
      state: {
        user: value.user,
        org: value.org,
        orgs: value.orgs,
      },
      version: 0,
    }))
  }, session)

  await gotoAndWait(page, destinationPath)
}

async function openNav(page: Page, name: RegExp) {
  const link = page.getByRole("link", { name }).first()
  await expect(link).toBeVisible()
  await link.click()
}

async function stubSyncBatch(page: Page) {
  await page.route("**/api/sync/batch", async (route) => {
    const body = route.request().postDataJSON() as { device_seq?: number; operations?: Array<{ client_id: string }> }
    const acked = Array.isArray(body?.operations) ? body.operations.map((operation) => operation.client_id) : []

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        acked,
        failed: [],
        conflicts: [],
        server_changes: [],
        last_seq: body?.device_seq ?? 0,
        server_timestamp: Date.now(),
      }),
    })
  })
}

test.describe("supervisor and admin demo flows", () => {
  test("supervisor dashboard, review, inventory, and conflict behavior", async ({ page }) => {
    test.setTimeout(120000)
    await stubSyncBatch(page)
    await loginFromDemo(page, /Dr\.?\s*Amara/i, "/supervisor/dashboard")

    await expect(page).toHaveURL(/\/supervisor\/dashboard/)
    await expect(page.getByText(/Tableau de bord|Dashboard/i).first()).toBeVisible({ timeout: 30000 })
    await openNav(page, /Review|File d'attente|Review Queue/i)
    await page.waitForURL(/\/supervisor\/review/, { waitUntil: "domcontentloaded", timeout: 30000 })
    await expect(page.getByRole("button", { name: /Approuver|Approve/i }).first()).toBeVisible()
    await page.getByRole("button", { name: /Demander des modifications|Request Changes/i }).first().click()
    const rationaleBox = page.locator("textarea").first()
    await expect(rationaleBox).toBeVisible()
    await rationaleBox.fill("Needs clearer household notes for supervisor verification.")
    await page.getByRole("button", { name: /Annuler|Cancel/i }).last().click()
    await expect(rationaleBox).toBeHidden()

    await gotoAndWait(page, "/supervisor/inventory")
    await expect(page.getByRole("heading", { level: 1, name: /Inventaire|Inventory|Stock/i })).toBeVisible({ timeout: 30000 })

    const reserveButton = page.getByRole("button", { name: /Réserver|Reserve/i }).first()
    if (await reserveButton.count() && await reserveButton.isEnabled()) {
      await reserveButton.click()
      await expect(page.getByText(/Réservation réussie|Reservation successful|Succès|Success/i).first()).toBeVisible()
    }

    await gotoAndWait(page, "/supervisor/conflicts")

    const noConflictsHeading = page.getByRole("heading", { name: /Aucun conflit|No conflicts/i })
    const resolutionHeading = page.getByRole("heading", { name: /Résolution|Resolution/i })

    if (await resolutionHeading.count()) {
      await expect(resolutionHeading).toBeVisible()
      const choiceButton = page.getByRole("button", { name: /Accepter les vôtres|Accept Yours/i }).first()
      if (await choiceButton.count()) {
        await choiceButton.click()
      }
      await expect(page.getByText(/résolu|resolved|fields?/i).first()).toBeVisible()
    } else {
      await expect(noConflictsHeading).toBeVisible()
      await expect(page.getByRole("button", { name: /Retour|Back/i })).toBeVisible()
    }
  })

  test("admin dashboard, workflows, users, and settings basics", async ({ page }) => {
    test.setTimeout(120000)
    await stubSyncBatch(page)
    await loginFromDemo(page, /Céline|Celine/i, "/admin/dashboard")

    await expect(page).toHaveURL(/\/admin\/dashboard/)
    await expect(page.getByText(/Tableau de bord|Dashboard/i).first()).toBeVisible({ timeout: 30000 })
    await openNav(page, /Workflows/i)
    await page.waitForURL(/\/admin\/workflows/, { waitUntil: "domcontentloaded", timeout: 30000 })
    await expect(page.getByRole("heading", { name: /Workflows/i })).toBeVisible()

    const workflowRows = page.locator("tbody tr")
    if ((await workflowRows.count()) > 0 && !await page.getByText(/Aucun workflow|No workflows/i).count()) {
      await gotoAndWait(page, "/admin/workflows/wf-1")
      await expect(page.getByRole("button", { name: "📱 Preview" })).toBeVisible()
      await page.getByRole("button", { name: "🔀 Flow" }).click()
      await page.getByRole("button", { name: "⚙ Settings" }).click()
      await page.getByRole("button", { name: /Sauvegarder|Save/i }).click()
      await expect(page.getByText(/Sauvegardé|Saved/i)).toBeVisible()
    }

    await gotoAndWait(page, "/admin/users")
    await expect(page.getByRole("heading", { name: /Utilisateurs|Users/i })).toBeVisible({ timeout: 30000 })
    await page.getByRole("button", { name: /Inviter|Invite/i }).click()
    await expect(page.getByRole("heading", { name: /Inviter|Invite/i })).toBeVisible()
    await page.getByRole("button", { name: /Annuler|Cancel/i }).click()
    await expect(page.getByRole("heading", { name: /Inviter|Invite/i })).toBeHidden()

    const userActionButton = page.getByRole("button", { name: /Désactiver|Deactivate|Activer|Activate/i }).first()
    if (await userActionButton.count()) {
      const originalLabel = await userActionButton.innerText()
      await userActionButton.click()
      await expect(userActionButton).not.toHaveText(originalLabel)
    }

    await gotoAndWait(page, "/admin/settings")
    await expect(page.getByRole("heading", { name: /Paramètres|Settings/i })).toBeVisible()
    const orgNameField = page.locator("input").first()
    await orgNameField.fill("FieldFlow Demo QA")
    await page.getByRole("button", { name: /Sauvegarder|Save|Succès|Success/i }).click()
    await expect(page.getByRole("button", { name: /Succès|Success/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /Supprimer l'organisation|Delete organization/i })).toBeDisabled()
  })
})
