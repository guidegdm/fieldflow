"use client"

import { db } from "@/lib/db/indexeddb"
import type { DemoUser } from "@/types/auth"
import { DEMO_ORGS, DEMO_USERS, ORG_MEMBERSHIPS, type DemoOrgKey, type Org } from "@/types/auth"
import type { RecordData } from "@/types/record"
import type { ConflictRecord } from "@/types/sync"
import type { WorkflowDefinition } from "@/types/workflow"

const DEMO_SANDBOX_STORAGE_KEY = "fieldflow-demo-sandbox"

type WorkflowListItem = WorkflowDefinition & { recordCount?: number }
export interface DemoOfflineWorkspace {
  orgId: string
  workflows: WorkflowDefinition[]
  records: RecordData[]
  conflicts?: ConflictRecord[]
}

export interface DemoOfflineAccount {
  email: string
  orgKey: DemoOrgKey
  user: DemoUser
  org: Org
  orgs: Org[]
}

export interface DemoOfflineSandbox {
  expiresAt: number
  savedAt: number
  workspaces: DemoOfflineWorkspace[]
  accounts: DemoOfflineAccount[]
}

function localInstallId() {
  if (typeof window === "undefined") return "local-offline"
  const key = "fieldflow-local-demo-install"
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const id = `local-${Math.random().toString(36).slice(2, 10)}`
  window.localStorage.setItem(key, id)
  return id
}

function localOrgId(installId: string, orgKey: DemoOrgKey) {
  return `demo-${installId}-${orgKey.toLowerCase()}`
}

function localWorkflow(orgId: string, orgKey: DemoOrgKey): WorkflowDefinition {
  const now = new Date().toISOString()
  const org = DEMO_ORGS[orgKey]
  return {
    id: "wf-1",
    orgId,
    version: 1,
    name: `${org.name} Field Operations`,
    nameEn: `${org.name} Field Operations`,
    description: org.summary || "Offline-first field workflow",
    descriptionEn: org.summary || "Offline-first field workflow",
    entity: {
      id: "entity-household",
      key: "household",
      label: "Menage",
      labelEn: "Household",
      displayField: "household_name",
      fields: [
        { id: "f-1", key: "household_name", label: "Nom du menage", labelEn: "Household name", type: "text", required: true, order: 1, section: "Identification" },
        { id: "f-2", key: "head_of_household", label: "Chef de menage", labelEn: "Head of household", type: "text", required: true, order: 2, section: "Identification" },
        { id: "f-3", key: "household_size", label: "Taille du menage", labelEn: "Household size", type: "number", required: true, validation: { min: 1, max: 20 }, order: 3, section: "Identification" },
        { id: "f-4", key: "shelter_type", label: "Type d'abri", labelEn: "Shelter type", type: "select", required: true, options: [{ label: "Tente", labelEn: "Tent", value: "tent" }, { label: "Abri provisoire", labelEn: "Temporary shelter", value: "temporary" }, { label: "Hebergement", labelEn: "Hosted", value: "hosted" }], order: 4, section: "Living conditions" },
        { id: "f-5", key: "village", label: "Village", labelEn: "Village", type: "text", required: true, order: 5, section: "Living conditions" },
        { id: "f-6", key: "vulnerability_score", label: "Score de vulnerabilite", labelEn: "Vulnerability score", type: "number", required: true, validation: { min: 1, max: 5 }, order: 6, section: "Priority needs" },
        { id: "f-7", key: "needs", label: "Besoins prioritaires", labelEn: "Priority needs", type: "multi_select", required: true, options: [{ label: "Nourriture", labelEn: "Food", value: "food" }, { label: "Eau potable", labelEn: "Drinking water", value: "water" }, { label: "Abri", labelEn: "Shelter", value: "shelter" }, { label: "Sante", labelEn: "Medical care", value: "medicine" }], order: 7, section: "Priority needs" },
        { id: "f-8", key: "notes", label: "Notes", labelEn: "Notes", type: "textarea", required: false, order: 8, section: "Priority needs" },
      ],
    },
    states: [
      { id: "s-draft", key: "draft", label: "Brouillon", labelEn: "Draft", color: "#6B7280", isInitial: true, isTerminal: false, x: 160, y: 120 },
      { id: "s-submitted", key: "submitted", label: "Soumis", labelEn: "Submitted", color: "#2563EB", isInitial: false, isTerminal: false, x: 380, y: 120 },
      { id: "s-verified", key: "verified", label: "Verifie", labelEn: "Verified", color: "#9333EA", isInitial: false, isTerminal: false, x: 600, y: 120 },
      { id: "s-approved", key: "approved", label: "Approuve", labelEn: "Approved", color: "#16A34A", isInitial: false, isTerminal: false, x: 820, y: 120 },
    ],
    transitions: [
      { id: "t-submit", key: "submit", label: "Soumettre", labelEn: "Submit", fromState: "s-draft", toState: "s-submitted", requiredRoles: ["field_worker"] },
      { id: "t-verify", key: "verify", label: "Verifier", labelEn: "Verify", fromState: "s-submitted", toState: "s-verified", requiredRoles: ["supervisor"] },
      { id: "t-approve", key: "approve", label: "Approuver", labelEn: "Approve", fromState: "s-verified", toState: "s-approved", requiredRoles: ["supervisor"] },
    ],
    roles: [
      { id: "r-field", key: "field_worker", label: "Agent terrain", labelEn: "Field Agent", permissions: ["record:create", "record:read_own", "record:update_own", "sync:push", "sync:pull"] },
      { id: "r-supervisor", key: "supervisor", label: "Superviseur", labelEn: "Supervisor", permissions: ["record:read_team", "record:verify", "record:approve", "sync:pull"] },
      { id: "r-admin", key: "org_admin", label: "Administrateur", labelEn: "Administrator", permissions: ["workflow:publish", "admin:manage_users", "audit:view"] },
    ],
    offlinePolicy: {
      maxOfflineHours: 72,
      allowedOperations: { create: true, update: true, delete: false, evidence: true },
      conflictStrategy: "manual",
      manualResolutionFields: ["household_size", "vulnerability_score"],
      autoResolutionNumeric: "average",
      maxAttachmentSizeMb: 5,
      allowedAttachmentTypes: ["image/jpeg", "image/png"],
      attachmentSyncPriority: "normal",
    },
    status: "published",
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    author: "offline-demo",
  }
}

function localRecords(orgId: string, orgKey: DemoOrgKey): RecordData[] {
  const now = Date.now()
  return [
    {
      id: `local-${orgKey.toLowerCase()}-submitted`,
      workflowId: "wf-1",
      workflowVersion: 1,
      entityKey: "household",
      deviceId: "offline-demo-device",
      status: "submitted",
      syncStatus: "local",
      state: "s-submitted",
      fields: {
        household_name: "Mukwege family",
        head_of_household: "Aline Mukwege",
        household_size: 6,
        shelter_type: "tent",
        village: "Mugunga",
        vulnerability_score: 5,
        needs: ["food", "water", "shelter"],
        notes: "Offline fallback demo record ready for supervisor review.",
      },
      version: 1,
      createdAt: now - 3600000,
      updatedAt: now - 1800000,
      createdBy: "offline-demo",
      orgId,
    },
    {
      id: `local-${orgKey.toLowerCase()}-approved`,
      workflowId: "wf-1",
      workflowVersion: 1,
      entityKey: "household",
      deviceId: "offline-demo-device",
      status: "approved",
      syncStatus: "synced",
      state: "s-approved",
      fields: {
        household_name: "Bahati household",
        head_of_household: "Patrick Bahati",
        household_size: 4,
        shelter_type: "temporary",
        village: "Sake",
        vulnerability_score: 3,
        needs: ["food"],
      },
      version: 2,
      createdAt: now - 7200000,
      updatedAt: now - 2400000,
      createdBy: "offline-demo",
      orgId,
    },
  ]
}

function localConflicts(orgId: string, orgKey: DemoOrgKey): ConflictRecord[] {
  return [{
    id: `local-${orgKey.toLowerCase()}-conflict`,
    workflow_id: "wf-1",
    record_id: `local-${orgKey.toLowerCase()}-submitted`,
    field: "vulnerability_score",
    orgId,
    value_a: 5,
    device_a: "field-device",
    value_b: 4,
    device_b: "supervisor-device",
    status: "OPEN",
    created_at: Date.now() - 900000,
  }]
}

export function createLocalDemoSandbox(): DemoOfflineSandbox {
  const installId = localInstallId()
  const expiresAt = Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000)
  const workspaces = (Object.keys(DEMO_ORGS) as DemoOrgKey[]).map((orgKey) => {
    const orgId = localOrgId(installId, orgKey)
    return {
      orgId,
      workflows: [localWorkflow(orgId, orgKey)],
      records: localRecords(orgId, orgKey),
      conflicts: localConflicts(orgId, orgKey),
    }
  })

  const orgs = (Object.keys(DEMO_ORGS) as DemoOrgKey[]).map((orgKey) => ({
    ...DEMO_ORGS[orgKey],
    id: localOrgId(installId, orgKey),
    key: orgKey,
    name: `${DEMO_ORGS[orgKey].name} Demo`,
  }))

  const accounts = ORG_MEMBERSHIPS.map((membership) => {
    const template = DEMO_USERS.find((candidate) => candidate.id === membership.userId)!
    const org = { ...orgs.find((candidate) => candidate.key === membership.orgKey)!, role: membership.role }
    return {
      email: template.email,
      orgKey: membership.orgKey,
      user: {
        ...template,
        id: `${template.id}-${installId}-${membership.orgKey.toLowerCase()}`,
        role: membership.role,
        orgId: org.id,
        deviceId: `${template.deviceId}-${installId}-${membership.orgKey.toLowerCase()}`,
      },
      org,
      orgs: ORG_MEMBERSHIPS
        .filter((allowed) => allowed.userId === membership.userId)
        .map((allowed) => {
          const allowedOrg = orgs.find((candidate) => candidate.key === allowed.orgKey)!
          return allowedOrg ? { ...allowedOrg, role: allowed.role } : allowedOrg
        })
        .filter(Boolean),
    }
  })

  return { expiresAt, savedAt: Date.now(), workspaces, accounts }
}

function isCacheablePageResponse(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  return response.ok && contentType.includes("text/html") && !contentType.includes("text/x-component")
}

export async function cacheOfflineRecordRoutes(workspaces?: DemoOfflineWorkspace[]) {
  if (typeof window === "undefined" || !workspaces?.length) return

  const urls = Array.from(new Set(
    workspaces.flatMap((workspace) => [
      ...workspace.workflows.map((workflow) => new URL(`/admin/workflows/${workflow.id}`, window.location.origin).href),
      ...workspace.records.map((record) => new URL(`/field-worker/record/${record.id}`, window.location.origin).href),
      ...workspace.records.map((record) => new URL(`/supervisor/review?id=${record.id}`, window.location.origin).href),
    ]),
  ))
  if (!urls.length) return

  if ("caches" in window) {
    const cache = await caches.open("fieldflow-pages")
    await Promise.all(urls.map(async (url) => {
      try {
        const request = new Request(url, {
          credentials: "include",
          cache: "reload",
          headers: { Accept: "text/html,application/xhtml+xml" },
        })
        const response = await fetch(request)
        if (isCacheablePageResponse(response)) {
          await cache.put(request, response.clone())
          await cache.put(url, response.clone())
        }
      } catch {}
    }))
  }

  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.ready.catch(() => null)
  const worker = registration?.active || registration?.waiting || registration?.installing
  if (!worker) return

  await new Promise<void>((resolve) => {
    const channel = new MessageChannel()
    const timeout = window.setTimeout(resolve, 12000)
    channel.port1.onmessage = () => {
      window.clearTimeout(timeout)
      resolve()
    }
    worker.postMessage(
      {
        type: "CACHE_URLS",
        payload: {
          urlsToCache: urls.map((url) => [url, { credentials: "include" }]),
        },
      },
      [channel.port2],
    )
  })
}

async function getJson<T>(url: string, orgId?: string): Promise<T | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, {
      credentials: "include",
      signal: controller.signal,
      headers: orgId ? { "x-fieldflow-org-id": orgId } : undefined,
    })
    if (!response.ok) return null
    return response.json() as Promise<T>
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
  }
}

async function writeWorkspace(user: DemoUser | null, workspace: DemoOfflineWorkspace) {
  await db.replaceWorkflowsForOrg(workspace.orgId, workspace.workflows)
  await db.replaceRecordsForOrg(workspace.orgId, workspace.records)
  await db.replaceConflictsForRecords(workspace.records.map((record) => record.id), Array.isArray(workspace.conflicts) ? workspace.conflicts : [], workspace.orgId)

  if (user?.orgId && workspace.orgId === user.orgId) {
    await db.updateDeviceState({
      device_id: user.deviceId,
      user_id: user.id,
      orgId: user.orgId,
      workflow_id: workspace.workflows[0]?.id || "",
      workflow_version: workspace.workflows[0]?.version || 1,
      version: workspace.workflows[0]?.version || 1,
      last_seq: 0,
      last_sync_at: Date.now(),
      pending_count: 0,
    })
  }
}

export function persistDemoSandbox(sandbox: Omit<DemoOfflineSandbox, "savedAt">) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(DEMO_SANDBOX_STORAGE_KEY, JSON.stringify({ ...sandbox, savedAt: Date.now() }))
}

export function loadOfflineDemoSandbox(): DemoOfflineSandbox | null {
  if (typeof window === "undefined") return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DEMO_SANDBOX_STORAGE_KEY) || "null") as DemoOfflineSandbox | null
    if (!parsed?.expiresAt || parsed.expiresAt * 1000 <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

export async function hydrateDemoWorkspaceOffline(user: DemoUser, workspaces?: DemoOfflineWorkspace[]) {
  if (!user.orgId) return { workflows: 0, records: 0, conflicts: 0, workspaces: 0 }

  if (workspaces?.length) {
    let workflows = 0
    let records = 0
    let conflicts = 0
    for (const workspace of workspaces) {
      await writeWorkspace(user, workspace)
      workflows += workspace.workflows.length
      records += workspace.records.length
      conflicts += workspace.conflicts?.length || 0
    }
    return { workflows, records, conflicts, workspaces: workspaces.length }
  }

  const workflows = await getJson<WorkflowListItem[]>("/api/workflows", user.orgId)
  if (!workflows?.length) return { workflows: 0, records: 0, conflicts: 0, workspaces: 0 }

  const workflowDefinitions: WorkflowDefinition[] = []
  const records: RecordData[] = []

  for (const workflow of workflows) {
    const definition = await getJson<WorkflowDefinition>(`/api/workflows/${workflow.id}/definition`, user.orgId)
    workflowDefinitions.push(definition ?? workflow)

    const workflowRecords = await getJson<RecordData[]>(`/api/workflows/${workflow.id}/records`, user.orgId)
    if (Array.isArray(workflowRecords)) records.push(...workflowRecords)
  }

  const conflicts = await getJson<ConflictRecord[]>("/api/sync/conflict", user.orgId)
  await writeWorkspace(user, {
    orgId: user.orgId,
    workflows: workflowDefinitions,
    records,
    conflicts: Array.isArray(conflicts) ? conflicts : [],
  })

  return {
    workflows: workflowDefinitions.length,
    records: records.length,
    conflicts: Array.isArray(conflicts) ? conflicts.length : 0,
    workspaces: 1,
  }
}

export async function hydrateAuthenticatedUserOffline(user: DemoUser & { orgs?: Array<{ id: string; name?: string }> }) {
  const orgs = user.orgs?.length ? user.orgs : user.orgId ? [{ id: user.orgId }] : []
  let workflows = 0
  let records = 0
  let conflicts = 0
  let workspaces = 0

  for (const org of orgs) {
    const scopedUser = { ...user, orgId: org.id }
    const result = await hydrateDemoWorkspaceOffline(scopedUser)
    workflows += result.workflows
    records += result.records
    conflicts += result.conflicts
    workspaces += result.workspaces
  }

  return { workflows, records, conflicts, workspaces }
}

export async function hydrateDemoSandboxOffline(workspaces?: DemoOfflineWorkspace[]) {
  if (!workspaces?.length) return { workflows: 0, records: 0, conflicts: 0, workspaces: 0 }

  let workflows = 0
  let records = 0
  let conflicts = 0
  for (const workspace of workspaces) {
    await writeWorkspace(null, workspace)
    workflows += workspace.workflows.length
    records += workspace.records.length
    conflicts += workspace.conflicts?.length || 0
  }

  return { workflows, records, conflicts, workspaces: workspaces.length }
}
