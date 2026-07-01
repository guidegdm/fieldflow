import { getStore } from "@/lib/api/in-memory-store"
import { DEMO_ORGS, DEMO_USERS, ORG_MEMBERSHIPS, type DemoOrgKey, type DemoUser, type Org } from "@/types/auth"
import type { RecordData } from "@/types/record"
import type { ConflictRecord, DeviceState } from "@/types/sync"
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
      displayField: "household_name",
      fields: [
        { id: "f-1", key: "household_name", label: "Nom du menage", labelEn: "Household name", type: "text", required: true, order: 1, section: "Identification" },
        { id: "f-2", key: "head_of_household", label: "Chef de menage", labelEn: "Head of household", type: "text", required: true, order: 2, section: "Identification" },
        { id: "f-3", key: "household_size", label: "Taille du menage", labelEn: "Household size", type: "number", required: true, validation: { min: 1, max: 20 }, order: 3, section: "Identification" },
        { id: "f-4", key: "shelter_type", label: "Type d'abri", labelEn: "Shelter type", type: "select", required: true, options: [{ label: "Tente", value: "tent" }, { label: "Abri provisoire", value: "temporary" }, { label: "Hebergement", value: "hosted" }], order: 4, section: "Identification" },
        { id: "f-5", key: "village", label: "Village", labelEn: "Village", type: "text", required: true, order: 5, section: "Identification" },
        { id: "f-6", key: "gps", label: "Coordonnees GPS", labelEn: "GPS Coordinates", type: "gps", required: false, order: 6, section: "Conditions de vie" },
        { id: "f-7", key: "vulnerability_score", label: "Score de vulnerabilite", labelEn: "Vulnerability score", type: "number", required: true, validation: { min: 1, max: 5 }, order: 7, section: "Conditions de vie" },
        { id: "f-8", key: "needs", label: "Besoins prioritaires", labelEn: "Priority needs", type: "multi_select", required: true, options: [{ label: "Nourriture", value: "food" }, { label: "Eau potable", value: "water" }, { label: "Materiel d'abri", value: "shelter" }, { label: "Medicaments", value: "medicine" }], order: 8, section: "Besoins" },
        { id: "f-9", key: "evidence_photo", label: "Photo preuve", labelEn: "Evidence photo", type: "photo", required: false, order: 9, section: "Besoins" },
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

function secondaryDemoWorkflows(orgId: string, orgKey: DemoOrgKey, expiresAt: number): WorkflowDefinition[] {
  const now = nowIso()
  const org = DEMO_ORGS[orgKey]
  return [
    {
      id: "wf-community-intake",
      orgId,
      version: 1,
      name: `${org.name} Community Intake`,
      nameEn: `${org.name} Community Intake`,
      description: "Rapid community requests, triage, and field follow-up.",
      descriptionEn: "Rapid community requests, triage, and field follow-up.",
      entity: {
        id: "entity-request",
        key: "request",
        label: "Demande communautaire",
        labelEn: "Community request",
        displayField: "request_title",
        fields: [
          { id: "req-1", key: "request_title", label: "Titre de la demande", labelEn: "Request title", type: "text", required: true, order: 1, section: "Intake" },
          { id: "req-2", key: "location", label: "Lieu", labelEn: "Location", type: "text", required: true, order: 2, section: "Intake" },
          { id: "req-3", key: "severity", label: "Gravite", labelEn: "Severity", type: "number", required: true, validation: { min: 1, max: 5 }, order: 3, section: "Triage" },
          { id: "req-4", key: "category", label: "Categorie", labelEn: "Category", type: "select", required: true, options: [{ label: "Eau", value: "water" }, { label: "Sante", value: "health" }, { label: "Protection", value: "protection" }], order: 4, section: "Triage" },
          { id: "req-5", key: "notes", label: "Notes", labelEn: "Notes", type: "textarea", required: false, order: 5, section: "Triage" },
        ],
      },
      states: [
        { id: "s-draft", key: "draft", label: "Brouillon", labelEn: "Draft", color: "#6B7280", isInitial: true, isTerminal: false, x: 140, y: 80 },
        { id: "s-submitted", key: "submitted", label: "Soumis", labelEn: "Submitted", color: "#2563EB", isInitial: false, isTerminal: false, x: 360, y: 80 },
        { id: "s-prioritized", key: "prioritized", label: "Priorise", labelEn: "Prioritized", color: "#D97706", isInitial: false, isTerminal: false, x: 580, y: 80 },
        { id: "s-closed", key: "closed", label: "Cloture", labelEn: "Closed", color: "#059669", isInitial: false, isTerminal: true, x: 800, y: 80 },
      ],
      transitions: [
        { id: "req-t-1", key: "submit", label: "Soumettre", labelEn: "Submit", fromState: "s-draft", toState: "s-submitted", requiredRoles: ["field_worker"] },
        { id: "req-t-2", key: "prioritize", label: "Prioriser", labelEn: "Prioritize", fromState: "s-submitted", toState: "s-prioritized", requiredRoles: ["supervisor"] },
        { id: "req-t-3", key: "close", label: "Cloturer", labelEn: "Close", fromState: "s-prioritized", toState: "s-closed", requiredRoles: ["supervisor"] },
      ],
      roles: [
        { id: "req-r-1", key: "field_worker", label: "Agent terrain", labelEn: "Field Agent", permissions: ["record:create", "record:read_own", "record:update_own", "sync:push", "sync:pull"] },
        { id: "req-r-2", key: "supervisor", label: "Superviseur", labelEn: "Supervisor", permissions: ["record:read_team", "record:verify", "record:approve", "sync:pull"] },
        { id: "req-r-3", key: "org_admin", label: "Administrateur", labelEn: "Administrator", permissions: ["workflow:publish", "admin:manage_users", "audit:view"] },
      ],
      offlinePolicy: {
        maxOfflineHours: 72,
        allowedOperations: { create: true, update: true, delete: false, evidence: false },
        conflictStrategy: "manual",
        manualResolutionFields: ["severity", "category"],
        autoResolutionNumeric: "max",
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
    },
    {
      id: "wf-stock-check",
      orgId,
      version: 1,
      name: `${org.name} Stock Check`,
      nameEn: `${org.name} Stock Check`,
      description: "Offline stock counts with supervisor confirmation.",
      descriptionEn: "Offline stock counts with supervisor confirmation.",
      entity: {
        id: "entity-stock-count",
        key: "stock_count",
        label: "Controle stock",
        labelEn: "Stock count",
        displayField: "item_name",
        fields: [
          { id: "stk-1", key: "item_name", label: "Article", labelEn: "Item", type: "text", required: true, order: 1, section: "Stock" },
          { id: "stk-2", key: "location", label: "Depot", labelEn: "Warehouse", type: "text", required: true, order: 2, section: "Stock" },
          { id: "stk-3", key: "counted_units", label: "Unites comptees", labelEn: "Counted units", type: "number", required: true, validation: { min: 0, max: 500 }, order: 3, section: "Stock" },
          { id: "stk-4", key: "condition", label: "Etat", labelEn: "Condition", type: "select", required: true, options: [{ label: "Bon", value: "good" }, { label: "Endommage", value: "damaged" }, { label: "Perime", value: "expired" }], order: 4, section: "Stock" },
        ],
      },
      states: [
        { id: "s-draft", key: "draft", label: "Brouillon", labelEn: "Draft", color: "#6B7280", isInitial: true, isTerminal: false, x: 140, y: 80 },
        { id: "s-submitted", key: "submitted", label: "Soumis", labelEn: "Submitted", color: "#2563EB", isInitial: false, isTerminal: false, x: 360, y: 80 },
        { id: "s-confirmed", key: "confirmed", label: "Confirme", labelEn: "Confirmed", color: "#059669", isInitial: false, isTerminal: true, x: 580, y: 80 },
      ],
      transitions: [
        { id: "stk-t-1", key: "submit", label: "Soumettre", labelEn: "Submit", fromState: "s-draft", toState: "s-submitted", requiredRoles: ["field_worker"] },
        { id: "stk-t-2", key: "confirm", label: "Confirmer", labelEn: "Confirm", fromState: "s-submitted", toState: "s-confirmed", requiredRoles: ["supervisor"] },
      ],
      roles: [
        { id: "stk-r-1", key: "field_worker", label: "Agent terrain", labelEn: "Field Agent", permissions: ["record:create", "record:read_own", "record:update_own", "sync:push", "sync:pull"] },
        { id: "stk-r-2", key: "supervisor", label: "Superviseur", labelEn: "Supervisor", permissions: ["record:read_team", "record:verify", "sync:pull"] },
        { id: "stk-r-3", key: "org_admin", label: "Administrateur", labelEn: "Administrator", permissions: ["workflow:publish", "admin:manage_users", "audit:view"] },
      ],
      offlinePolicy: {
        maxOfflineHours: 48,
        allowedOperations: { create: true, update: true, delete: false, evidence: false },
        conflictStrategy: "manual",
        manualResolutionFields: ["counted_units", "condition"],
        autoResolutionNumeric: "max",
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
    },
  ]
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

function secondaryDemoRecords(orgId: string, orgKey: DemoOrgKey, deviceId: string, expiresAt: number): RecordData[] {
  const now = Date.now()
  const prefix = orgKey.toLowerCase()
  return [
    {
      workflowId: "wf-community-intake",
      workflowVersion: 1,
      entityKey: "request",
      syncStatus: "synced",
      deviceId,
      version: 1,
      orgId,
      expiresAt,
      id: `${prefix}-req-water-point`,
      status: "pending",
      state: "s-submitted",
      fields: { request_title: "Water point repair", location: "Kanyaruchinya", severity: 4, category: "water", notes: "Pump has been offline for two days." },
      createdAt: now - 43200000,
      updatedAt: now - 39000000,
      syncedAt: now - 39000000,
      createdBy: "demo",
    },
    {
      workflowId: "wf-stock-check",
      workflowVersion: 1,
      entityKey: "stock_count",
      syncStatus: "synced",
      deviceId,
      version: 1,
      orgId,
      expiresAt,
      id: `${prefix}-stock-nfi-kit`,
      status: "pending",
      state: "s-submitted",
      fields: { item_name: "NFI Kit A", location: "Goma depot", counted_units: 3, condition: "good" },
      createdAt: now - 28800000,
      updatedAt: now - 25200000,
      syncedAt: now - 25200000,
      createdBy: "demo",
    },
  ]
}

export async function seedIsolatedDemoOrg(
  persona: DemoUser,
  installId: string,
  selectedOrgKey?: DemoOrgKey,
): Promise<{
  org: Org
  orgs: Org[]
  user: DemoUser
  seeded: boolean
  expiresAt: number
  seedCounts: { workspaces: number; workflows: number; records: number; conflicts: number; inventoryItems: number; demoAccounts: number }
  offlineWorkspaces: Array<{ orgId: string; workflows: WorkflowDefinition[]; records: RecordData[]; conflicts: ConflictRecord[] }>
  offlineAccounts: Array<{ email: string; orgKey: DemoOrgKey; user: DemoUser; org: Org; orgs: Org[] }>
}> {
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

    await store.putWorkflowForOrg(demoWorkflow(org.id, scenarioOrgKey, expiresAt))
    for (const workflow of secondaryDemoWorkflows(org.id, scenarioOrgKey, expiresAt)) {
      await store.putWorkflowForOrg(workflow)
    }

    const existingRecords = await store.getRecordsByWorkflowForOrg("wf-1", org.id)
    if (existingRecords.length === 0) {
      seeded = true
      const deviceId = `device-a-${suffix}-${scenarioOrgKey.toLowerCase()}`
      for (const record of [
        ...demoRecords(org.id, scenarioOrgKey, deviceId, expiresAt),
        ...secondaryDemoRecords(org.id, scenarioOrgKey, deviceId, expiresAt),
      ]) {
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
  const org = { ...installedOrg(installId, selectedMembership.orgKey), role: selectedMembership.role }
  const orgs = allowedMemberships.map((membership) => ({ ...installedOrg(installId, membership.orgKey), role: membership.role }))
  const user = {
    ...persona,
    id: `${persona.id}-${suffix}-${selectedMembership.orgKey.toLowerCase()}`,
    role: selectedMembership.role,
    orgId: org.id,
    deviceId: `${persona.deviceId}-${suffix}-${selectedMembership.orgKey.toLowerCase()}`,
  }

  const allInstalledOrgs = (Object.keys(DEMO_ORGS) as DemoOrgKey[]).map((orgKey) => installedOrg(installId, orgKey))
  const offlineWorkspaces = await Promise.all(allInstalledOrgs.map(async (workspaceOrg) => ({
    orgId: workspaceOrg.id,
    workflows: await store.getWorkflowsByOrgAsync(workspaceOrg.id),
    records: await store.getAllRecordsForOrg(workspaceOrg.id),
    conflicts: await store.getOpenConflictsForOrg(workspaceOrg.id),
  })))
  const inventoryCounts = await Promise.all(allInstalledOrgs.map((workspaceOrg) => store.getInventoryItemsForOrg(workspaceOrg.id).then((items) => items.length)))
  const offlineAccounts = ORG_MEMBERSHIPS.map((membership) => {
    const demoUser = DEMO_USERS.find((candidate) => candidate.id === membership.userId)!
    const accountOrg = { ...installedOrg(installId, membership.orgKey), role: membership.role }
    return {
      email: demoUser.email,
      orgKey: membership.orgKey,
      user: {
        ...demoUser,
        id: `${demoUser.id}-${suffix}-${membership.orgKey.toLowerCase()}`,
        role: membership.role,
        orgId: accountOrg.id,
        deviceId: `${demoUser.deviceId}-${suffix}-${membership.orgKey.toLowerCase()}`,
      },
      org: accountOrg,
      orgs: membershipsFor(demoUser.id).map((allowed) => ({ ...installedOrg(installId, allowed.orgKey), role: allowed.role })),
    }
  })
  const seedCounts = {
    workspaces: offlineWorkspaces.length,
    workflows: offlineWorkspaces.reduce((total, workspace) => total + workspace.workflows.length, 0),
    records: offlineWorkspaces.reduce((total, workspace) => total + workspace.records.length, 0),
    conflicts: offlineWorkspaces.reduce((total, workspace) => total + workspace.conflicts.length, 0),
    inventoryItems: inventoryCounts.reduce((total, count) => total + count, 0),
    demoAccounts: offlineAccounts.length,
  }

  await store.pushAuditEventForOrg({
    id: `demo-sandbox-${suffix}-${selectedMembership.orgKey}-${Date.now()}`,
    type: "demo_sandbox_login",
    install_id: suffix,
    user_id: user.id,
    org_id: org.id,
    selected_org_key: selectedMembership.orgKey,
    sandbox_created: seeded,
    status: "installed",
    detail: seeded ? `Created demo sandbox ${org.id}` : `Reopened demo sandbox ${org.id}`,
    expiresAt,
    timestamp: Date.now(),
  }, org.id)

  await store.putDemoSandboxMetric({
    installId: suffix,
    orgId: org.id,
    selectedOrgKey: selectedMembership.orgKey,
    userId: user.id,
    seeded,
    ...seedCounts,
    expiresAt,
    timestamp: Date.now(),
  })

  return { org, orgs, user, seeded, expiresAt, seedCounts, offlineWorkspaces, offlineAccounts }
}
