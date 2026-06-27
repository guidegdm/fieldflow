export type UserRole = "field_worker" | "supervisor" | "org_admin"
export type DemoOrgKey = "AHK" | "SRB" | "LE"

export interface DemoUser {
  id: string; email: string; name: string; role: UserRole; deviceId: string; token?: string; orgId?: string
}

export interface Org {
  id: string
  name: string
  key?: string
  sector?: string
  region?: string
  summary?: string
}

export interface DemoMembership {
  userId: string
  orgKey: DemoOrgKey
  role: UserRole
}

export interface DemoScenario {
  orgKey: DemoOrgKey
  title: string
  description: string
}

export const DEMO_USERS: DemoUser[] = [
  { id: "user-1", email: "jean-pierre@demo.ff", name: "Jean-Pierre", role: "field_worker", deviceId: "device-a" },
  { id: "user-2", email: "fatima@demo.ff", name: "Fatima", role: "field_worker", deviceId: "device-b" },
  { id: "user-3", email: "dr-amara@demo.ff", name: "Dr. Amara", role: "supervisor", deviceId: "device-c" },
  { id: "user-4", email: "celine@demo.ff", name: "Céline", role: "org_admin", deviceId: "device-admin" },
]

export const DEMO_ORGS: Record<DemoOrgKey, Org> = {
  AHK: {
    id: "AHK",
    key: "AHK",
    name: "Aid Hub Kivu",
    sector: "Humanitarian response",
    region: "North Kivu",
    summary: "Emergency household registration, warehouse reservations, and field distribution.",
  },
  SRB: {
    id: "SRB",
    key: "SRB",
    name: "Santé Rurale Bukavu",
    sector: "Mobile health",
    region: "South Kivu",
    summary: "Clinic outreach intake, supervisor review, and offline follow-up in rural health zones.",
  },
  LE: {
    id: "LE",
    key: "LE",
    name: "Logistics Est",
    sector: "Relief logistics",
    region: "Eastern DRC",
    summary: "Inventory-critical operations for last-mile aid delivery across field teams.",
  },
}

export const ORG_MEMBERSHIPS: DemoMembership[] = [
  { userId: "user-1", orgKey: "AHK", role: "field_worker" },
  { userId: "user-2", orgKey: "AHK", role: "field_worker" },
  { userId: "user-3", orgKey: "AHK", role: "supervisor" },
  { userId: "user-4", orgKey: "AHK", role: "org_admin" },
  { userId: "user-2", orgKey: "SRB", role: "field_worker" },
  { userId: "user-3", orgKey: "SRB", role: "supervisor" },
  { userId: "user-4", orgKey: "SRB", role: "org_admin" },
  { userId: "user-1", orgKey: "LE", role: "field_worker" },
  { userId: "user-3", orgKey: "LE", role: "supervisor" },
  { userId: "user-4", orgKey: "LE", role: "org_admin" },
]

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    orgKey: "AHK",
    title: "Emergency Aid Distribution",
    description: "Run the full household registration to inventory reservation workflow.",
  },
  {
    orgKey: "SRB",
    title: "Mobile Health Outreach",
    description: "Review vulnerable household cases across a second organization as shared leadership.",
  },
  {
    orgKey: "LE",
    title: "Last-Mile Logistics",
    description: "Stress the inventory and sync model from an operations-heavy workspace.",
  },
]
