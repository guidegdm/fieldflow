import { expect, test, type Page } from "@playwright/test"

const baseUrl = process.env.BASE_URL || "http://localhost:3000"

test.use({
  viewport: { width: 390, height: 844 },
})

async function setFrenchLanguage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("fieldflow-lang", "fr")
  })
}

async function loginAsFieldWorker(page: Page) {
  await page.goto(`${baseUrl}/demo`, { waitUntil: "domcontentloaded" })
  await page.locator("body").waitFor({ state: "visible" })
  const persona = page.getByRole("button", { name: /Jean-Pierre/i })
  await expect(persona).toBeEnabled({ timeout: 30000 })
  await persona.click()
  await page.waitForURL(/\/field-worker\/home/, { waitUntil: "domcontentloaded", timeout: 45000 })
  await expect(page.locator('a[href="/field-worker/search"]')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('a[href="/field-worker/status"]')).toBeVisible()
  await expect(page.locator('a[href="/field-worker/register"]')).toBeAttached()
}

async function setNetworkMode(page: Page, mode: "online" | "offline") {
  await page.waitForFunction(() => typeof (window as typeof window & {
    __fieldflowSetNetworkMode?: (mode: "online" | "offline") => void
  }).__fieldflowSetNetworkMode === "function")
  await page.evaluate((nextMode) => {
    ;(window as typeof window & {
      __fieldflowSetNetworkMode?: (mode: "online" | "offline") => void
    }).__fieldflowSetNetworkMode?.(nextMode)
  }, mode)
  await page.waitForTimeout(250)
  await expect(page.getByText(mode === "offline" ? /Hors ligne|Offline/i : /En ligne|Online/i).first()).toBeVisible({ timeout: 10000 })
}

async function readObjectStore<T>(page: Page, storeName: string): Promise<T[]> {
  return page.evaluate(async (targetStore) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("fieldflow")
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })

    const values = await new Promise<unknown[]>((resolve, reject) => {
      const tx = database.transaction(targetStore, "readonly")
      const store = tx.objectStore(targetStore)
      const request = store.getAll()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })

    database.close()
    return values
  }, storeName) as Promise<T[]>
}

async function getLocalRecordCount(page: Page): Promise<number> {
  const records = await readObjectStore(page, "records")
  return records.length
}

test.describe("field worker demo offline flows", () => {
  test.beforeEach(async ({ page }) => {
    await setFrenchLanguage(page)
  })

  test("navigates field worker demo surfaces and seeded records", async ({ page }) => {
    test.slow()

    await loginAsFieldWorker(page)

    await expect(page.locator('a[href="/field-worker/search"]')).toBeVisible()
    await expect(page.locator('a[href="/field-worker/status"]')).toBeVisible()
    await expect(page.locator('a[href="/field-worker/register"]')).toBeVisible()

    await page.locator('a[href="/field-worker/search"]').click()
    await page.waitForURL(/\/field-worker\/search/)
    await expect(page.locator("h1")).toContainText(/Rechercher|Search/i)
    await expect(page.locator('input[type="search"]')).toBeVisible()

    await page.locator('a[href="/field-worker/status"]').click()
    await page.waitForURL(/\/field-worker\/status/)
    await expect(page.locator("h1")).toContainText(/État de synchronisation/i)
    await expect(page.getByText(/Enregistrements locaux/i)).toBeVisible()

    await page.locator('a[href="/field-worker/home"]').click()
    await page.waitForURL(/\/field-worker\/home/)

    const records = await readObjectStore<{ id: string; fields?: { household_name?: string } }>(page, "records")
    expect(records.length).toBeGreaterThan(0)

    const seededRecord = records.find((record) => record.fields?.household_name)
    expect(seededRecord?.id).toBeTruthy()

    await page.locator('a[href="/field-worker/search"]').click()
    await page.waitForURL(/\/field-worker\/search/)
    await page.locator('input[type="search"]').fill(String(seededRecord!.fields!.household_name))
    await page.locator(`a[href="/field-worker/record/${seededRecord!.id}"]`).first().click()
    await page.waitForURL(new RegExp(`/field-worker/record/${seededRecord!.id}$`))
    await expect(page.getByText(/Chronologie|Timeline|Audit/i)).toBeVisible()
    await expect(page.getByText(String(seededRecord!.fields!.household_name))).toBeVisible()
  })

  test("creates a registration offline, keeps it in IndexedDB, and syncs after reconnect", async ({ page }) => {
    test.slow()

    await loginAsFieldWorker(page)

    const initialRecordCount = await getLocalRecordCount(page)

    await page.goto(`${baseUrl}/field-worker/search`, { waitUntil: "domcontentloaded" })
    await page.goto(`${baseUrl}/field-worker/status`, { waitUntil: "domcontentloaded" })
    await page.goto(`${baseUrl}/field-worker/home`, { waitUntil: "domcontentloaded" })
    await page.locator('a[href="/field-worker/register"]').click()
    await page.waitForURL(/\/field-worker\/register/)
    await expect(page.locator('input[name="household_name"]')).toBeVisible()

    await setNetworkMode(page, "offline")

    const uniqueSuffix = Date.now().toString()
    const householdName = `Test ménage ${uniqueSuffix}`
    const headOfHousehold = `Chef ${uniqueSuffix}`
    const village = `Village ${uniqueSuffix}`

    await page.locator('input[name="household_name"]').fill(householdName)
    await page.locator('input[name="head_of_household"]').fill(headOfHousehold)
    await page.locator('input[name="household_size"]').fill("6")
    await page.locator('select[name="shelter_type"]').selectOption("tente")
    await page.locator('input[name="village"]').fill(village)
    await page.locator('input[name="location"]').fill("Camp Mugunga")
    await page.locator('input[name="vulnerability_score"]').fill("4")
    await page.locator('input[type="checkbox"]').nth(0).check()
    await page.locator('input[type="checkbox"]').nth(1).check()
    await page.locator('textarea[name="notes"]').fill("Saisie hors ligne de verification")
    const saveButton = page.getByRole("button", { name: /Enregistrer|Save/i })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    await expect(page.getByText(/Enregistré localement|Saved Locally/i)).toBeVisible()
    await page.getByRole("button", { name: /Retour|Back/i }).click()
    await page.waitForURL(/\/field-worker\/home/)
    await expect(page.getByText(householdName).first()).toBeVisible()

    const localRecords = await readObjectStore<{
      id: string
      syncStatus?: string
      fields?: { household_name?: string; village?: string }
    }>(page, "records")
    const createdRecord = localRecords.find((record) => record.fields?.household_name === householdName)
    expect(createdRecord).toBeTruthy()
    expect(createdRecord?.syncStatus).toBe("local")

    const localMutations = await readObjectStore<{
      client_id: string
      record_id?: string
      status?: string
      operation?: string
    }>(page, "mutations")
    const pendingMutation = localMutations.find((mutation) => mutation.client_id === createdRecord?.id)
    expect(pendingMutation).toMatchObject({
      client_id: createdRecord?.id,
      record_id: createdRecord?.id,
      operation: "create",
      status: "PENDING",
    })

    await page.locator('a[href="/field-worker/search"]').click()
    await page.waitForURL(/\/field-worker\/search/)
    await page.locator('input[type="search"]').fill(householdName)
    await expect(page.locator(`a[href="/field-worker/record/${createdRecord!.id}"]`)).toBeVisible()
    await page.locator(`a[href="/field-worker/record/${createdRecord!.id}"]`).click()
    await page.waitForURL(new RegExp(`/field-worker/record/${createdRecord!.id}$`))
    await expect(page.getByText(householdName)).toBeVisible()
    await expect(page.getByText(headOfHousehold)).toBeVisible()
    await expect(page.getByText(village)).toBeVisible()

    await page.locator('button').filter({ hasText: /Retour|Back/i }).click()
    await page.waitForURL(/\/field-worker\/search/)
    await page.locator('a[href="/field-worker/status"]').click()
    await page.waitForURL(/\/field-worker\/status/)
    await expect(page.getByText(/Hors ligne|Offline/i).first()).toBeVisible()
    const localRecordCountText = await page.locator("dd").nth(3).textContent()
    expect(Number(localRecordCountText?.trim())).toBeGreaterThanOrEqual(initialRecordCount + 1)

    await setNetworkMode(page, "online")

    const syncResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/sync/batch") && response.request().method() === "POST",
    )
    await page.getByRole("button", { name: /Synchroniser maintenant|Sync Now|Synchronisation en cours/i }).click()

    const syncResponse = await syncResponsePromise
    const syncPayload = await syncResponse.json()
    expect(syncResponse.status(), JSON.stringify(syncPayload)).toBe(200)
    if (syncPayload.acked.length > 0) {
      expect(syncPayload.acked).toContain(createdRecord!.id)
    }

    await expect.poll(async () => {
      const mutations = await readObjectStore<{ client_id: string }>(page, "mutations")
      return mutations.some((mutation) => mutation.client_id === createdRecord!.id)
    }).toBe(false)

    await expect.poll(async () => {
      const records = await readObjectStore<{
        id: string
        syncStatus?: string
        status?: string
        fields?: { household_name?: string }
      }>(page, "records")
      const record = records.find((candidate) => candidate.id === createdRecord!.id)
      return {
        exists: Boolean(record),
        syncStatus: record?.syncStatus ?? null,
        status: record?.status ?? null,
      }
    }).toEqual({
      exists: true,
      syncStatus: "pending",
      status: "pending_sync",
    })

    await expect(page.getByText(/En attente de synchronisation/i).locator("..").locator("dd")).toHaveText("0")

    await page.locator('a[href="/field-worker/search"]').click()
    await page.waitForURL(/\/field-worker\/search/)
    await page.locator('input[type="search"]').fill(householdName)
    await expect(page.getByText(householdName)).toBeVisible()
  })
})
