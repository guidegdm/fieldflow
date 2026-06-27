import { getStore } from "@/lib/api/in-memory-store"
import { DEMO_ORGS, DEMO_USERS, ORG_MEMBERSHIPS, type DemoOrgKey, type DemoUser, type Org } from "@/types/auth"
import type { RecordData } from "@/types/record"
import type { DeviceState } from "@/types/sync"
import type { WorkflowDefinition } from "@/types/workflow"

const nowIso = () => new Date().toISOString()
const orgIdFor = (installId: string, orgKey: DemoOrgKey) => `demo-${installId.slice(0, 12)}-${orgKey.toLowerCase()}`

function installedOrg(installId: string, orgKey: DemoOrgKey): Org {
  const template = DEMO_ORGS[orgKey]
  return {
    ...template,
    id: orgIdFor(installId, orgKey),
    key: orgKey,
    name: `${template.name} Demo`,
  }
}

function membershipsFor(userId: string) {
  return ORG_MEMBERSHIPS.filter((membership) => membership.userId === userId)
}

function demoWorkflow(orgId: string, orgKey: DemoOrgKey, expiresAt: number): WorkflowDefinition {
  const now = nowIso()
  const org = DEMO_ORGS[orgKey]
  return {
    id: "wf-1",
    orgId,
    version: 2,
    name: `${org.name} Field Operations`,
    nameEn: `${org.name} Field Operations`,
    description: org.summary || "Offline-first field workflow with review and inventory controls",
    descriptionEn: org.summary || "Offline-first field workflow with review and inventory controls",
    entity: {
      id: "entity-household",
      key: "household",
      label: "Menage",
      labelEn: "Household",
      fields: [
        { id: "f-1", key: "household_name", label: "Nom du menage", labelEn: "Household name", type: "text", required: true, order: 1, section: "Identification" },
        { id: "f-2", key: "head_of_household", label: "Chef de menage", labelEn: "Head of household", type: "text", required: true, order: 2, section: "Identification" },
        { id: "f-3", key: "household_size", label: "Taille du menage", labelEn: "Household size", type: "number", required: true, validation: { min: 1, max: 20 }, order: 3, section: "Identification" },
        { id: "f-4", key: "shelter_type", label: "Type d'abri", labelEn: "Shelter type", type: "select", required: true, options: [{ label: "Tente", value: "tent" }, { label: "Abri provisoire", value: "temporary" }, { label: "Hebergement", value: "hosted" }], order: 4, section: "Identification" },
        { id: "f-5", key: "village", label: "Village", labelEn: "Village", type: "text", required: true, order: 5, section: "Identification" },
        { id: "f-6", key: "gps", label: "Coordonnees GPS", labelEn: "GPS Coordinates", type: "gps", required: false, order: 6, section: "Conditions de vie" },
        { id: "f-7", key: "vulnerability_score", label: "Score de vulnerabilite", labelEn: "Vulnerability score", type: "number", required: true, validation: { min: 1, max: 5 }, order: 7, section: "Conditions de vie" },
        { id: "f-8", key: "needs", label: "Besoins prioritaires", labelEn: "Priority needs", type: "multi_select", required: true, options: [{ label: "Nourriture", value: "food" }, { label: "Eau potable", value: "water" }, { label: "Materiel d'abri", value: "shelter" }, { label: "Medicaments", value: "medicine" }], order: 8, section: "Besoins" },
      ],
    },
    states: [
      { id: "s-draft", key: "draft", label: "Brouillon", labelEn: "Draft", color: "#6B7280", isInitial: true, isTerminal: false, x: 200, y: 50 },
      { id: "s-submitted", key: "submitted", label: "Soumis", labelEn: "Submitted", color: "#2563EB", isInitial: false, isTerminal: false, x: 200, y: 150 },
      { id: "s-verified", key: "verified", label: "Verifie", labelEn: "Verified", color: "#9333EA", isInitial: false, isTerminal: false, x: 200, y: 250 },
      { id: "s-approved", key: "approved", label: "Approuve", labelEn: "Approved", color: "#16A34A", isInitial: false, isTerminal: false, x: 200, y: 350 },
      { id: "s-reserved", key: "reserved", label: "Reserve", labelEn: "Reserved", color: "#D97706", isInitial: false, isTerminal: false, x: 200, y: 450 },
      { id: "s-distributed", key: "distributed", label: "Distribue", labelEn: "Distributed", color: "#059669", isInitial: false, isTerminal: false, x: 200, y: 550 },
      { id: "s-confirmed", key: "confirmed", label: "Confirme", labelEn: "Confirmed", color: "#1D4ED8", isInitial: false, isTerminal: true, x: 200, y: 650 },
    ],
    transitions: [
      { id: "t-1", key: "submit", label: "Soumettre", labelEn: "Submit", fromState: "s-draft", toState: "s-submitted", requiredRoles: ["field_worker"] },
      { id: "t-2", key: "verify", label: "Verifier", labelEn: "Verify", fromState: "s-submitted", toState: "s-verified", requiredRoles: ["supervisor"] },
      { id: "t-3", key: "approve", label: "Approuver", labelEn: "Approve", fromState: "s-verified", toState: "s-approved", requiredRoles: ["supervisor"] },
      { id: "t-4", key: "reserve", label: "Reserver", labelEn: "Reserve", fromState: "s-approved", toState: "s-reserved", requiredRoles: ["supervisor"], sideEffects: ["inventory_reserve"] },
      { id: "t-5", key: "distribute", label: "Distribuer", labelEn: "Distribute", fromState: "s-reserved", toState: "s-distributed", requiredRoles: ["field_worker"] },
      { id: "t-6", key: "confirm", label: "Confirmer", labelEn: "Confirm", fromState: "s-distributed", toState: "s-confirmed", requiredRoles: ["field_worker"] },
    ],
    roles: [
      { id: "r-1", key: "field_worker", label: "Agent terrain", permissions: ["record:create", "record:read_own", "record:update_own", "sync:push", "sync:pull"] },
      { id: "r-2", key: "supervisor", label: "Superviseur", permissions: ["record:create", "record:read_team", "record:verify", "record:approve", "sync:push", "sync:pull", "audit:view"] },
      { id: "r-3", key: "org_admin", label: "Administrateur", permissions: ["record:create", "record:read_team", "record:verify", "record:approve", "sync:push", "sync:pull", "audit:view", "workflow:publish", "admin:manage_users"] },
    ],
    offlinePolicy: {
      maxOfflineHours: 72,
      allowedOperations: { create: true, update: true, delete: false, evidence: true },
      conflictStrategy: "manual",
      manualResolutionFields: ["household_size", "gps", "vulnerability_score"],
      autoResolutionNumeric: "average",
      maxAttachmentSizeMb: 5,
      allowedAttachmentTypes: ["image/jpeg", "image/png"],
      attachmentSyncPriority: "normal",
    },
    status: "published",
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    author: "demo-seed",
    expiresAt,
  }
}

function demoRecords(orgId: string, orgKey: DemoOrgKey, deviceId: string, expiresAt: number): RecordData[] {
  const now = Date.now()
  const prefix = orgKey.toLowerCase()
  const village = orgKey === "AHK" ? "Kitatumba" : orgKey === "SRB" ? "Kadutu" : "Mugunga"
  const base = { workflowId: "wf-1", workflowVersion: 2, entityKey: "household", syncStatus: "synced", deviceId, version: 1, orgId, expiresAt }
  return [
    {
      ...base,
      id: `${prefix}-rec-muhindo`,
      status: "approved",
      state: "s-approved",
      fields: { household_name: "Famille Muhindo", head_of_household: "Amina Muhindo", household_size: 5, shelter_type: "tent", village, gps: "0.518, 29.474", vulnerability_score: 3, needs: ["food", "water"] },
      createdAt: now - 86400000,
      updatedAt: now - 3600000,
      syncedAt: now - 3600000,
      createdBy: "demo",
    },
    {
      ...base,
      id: `${prefix}-rec-hassan`,
      status: "pending",
      state: "s-submitted",
      fields: { household_name: "Famille Hassan", head_of_household: "Omar Hassan", household_size: 6, shelter_type: "temporary", village, gps: "-0.125, 29.310", vulnerability_score: 4, needs: ["food", "shelter", "medicine"] },
      createdAt: now - 172800000,
      updatedAt: now - 7200000,
      syncedAt: now - 7200000,
      createdBy: "demo",
    },
    {
      ...base,
      id: `${prefix}-rec-kamili`,
      status: "distributed",
      state: "s-distributed",
      fields: { household_name: "Famille Kamili", head_of_household: "Esther Kamili", household_size: 4, shelter_type: "hosted", village, gps: "0.233, 29.410", vulnerability_score: 2, needs: ["food", "water", "shelter"] },
      createdAt: now - 259200000,
      updatedAt: now - 10800000,
      syncedAt: now - 10800000,
      createdBy: "demo",
    },
  ]
}

export async function seedIsolatedDemoOrg(
  persona: DemoUser,
  installId: string,
  selectedOrgKey?: DemoOrgKey,
): Promise<{ org: Org; orgs: Org[]; user: DemoUser; seeded: boolean }> {
  const store = getStore()
  const suffix = installId.slice(0, 12)
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  let seeded = false

  for (const scenarioOrgKey of Object.keys(DEMO_ORGS) as DemoOrgKey[]) {
    const org = installedOrg(installId, scenarioOrgKey)
    await store.putOrgAsync({
      id: org.id,
      name: org.name,
      key: scenarioOrgKey,
      sector: org.sector,
      region: org.region,
      summary: org.summary,
      demo: true,
      demoInstallId: installId,
      createdAt: Date.now(),
      createdBy: "anonymous-demo",
      expiresAt,
    })

    const existingWorkflow = await store.getWorkflowForOrgAsync("wf-1", org.id)
    if (!existingWorkflow) {
      seeded = true
      await store.putWorkflowForOrg(demoWorkflow(org.id, scenarioOrgKey, expiresAt))
      for (const record of demoRecords(org.id, scenarioOrgKey, `device-a-${suffix}-${scenarioOrgKey.toLowerCase()}`, expiresAt)) {
        await store.putRecordForOrg(record)
      }
      await store.putInventoryItemForOrg({ id: `${scenarioOrgKey.toLowerCase()}-inv-nfi-kit`, name: "NFI Kit A", total: 3, reserved: 0, orgId: org.id, expiresAt })
      await store.putInventoryItemForOrg({ id: `${scenarioOrgKey.toLowerCase()}-inv-food-parcel`, name: "Food Parcel 7-day", total: 8, reserved: 0, orgId: org.id, expiresAt })
    }
  }

  for (const membership of ORG_MEMBERSHIPS) {
    const demoUser = DEMO_USERS.find((candidate) => candidate.id === membership.userId)
    if (!demoUser) continue
    const org = installedOrg(installId, membership.orgKey)
    await store.putUserProfileAsync({
      userId: `${demoUser.id}-${suffix}-${membership.orgKey.toLowerCase()}`,
      email: demoUser.email,
      name: demoUser.name,
      role: membership.role,
      orgId: org.id,
      active: true,
      demo: true,
      demoInstallId: installId,
      createdAt: Date.now(),
      expiresAt,
    })

    const device: DeviceState = {
      key: "current",
      device_id: `${demoUser.deviceId}-${suffix}-${membership.orgKey.toLowerCase()}`,
      last_seq: 0,
      last_sync_at: Date.now(),
      pending_count: 0,
      version: 2,
      user_id: `${demoUser.id}-${suffix}-${membership.orgKey.toLowerCase()}`,
      workflow_id: "wf-1",
      workflow_version: 2,
      orgId: org.id,
      expiresAt,
    }
    await store.putDeviceForOrg(device)
  }

  const allowedMemberships = membershipsFor(persona.id)
  const selectedMembership = allowedMemberships.find((membership) => membership.orgKey === selectedOrgKey) ?? allowedMemberships[0]
  const org = installedOrg(installId, selectedMembership.orgKey)
  const orgs = allowedMemberships.map((membership) => installedOrg(installId, membership.orgKey))
  const user = {
    ...persona,
    id: `${persona.id}-${suffix}-${selectedMembership.orgKey.toLowerCase()}`,
    role: selectedMembership.role,
    orgId: org.id,
    deviceId: `${persona.deviceId}-${suffix}-${selectedMembership.orgKey.toLowerCase()}`,
  }

  return { org, orgs, user, seeded }
}
