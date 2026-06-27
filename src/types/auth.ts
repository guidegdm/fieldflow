export type UserRole = "field_worker" | "supervisor" | "org_admin"

export interface DemoUser {
  id: string; email: string; name: string; role: UserRole; deviceId: string; token: string; orgId: string
}

export interface Org {
  id: string
  name: string
}

export const DEMO_USERS: DemoUser[] = [
  { id: "user-1", email: "jean-pierre@demo.ff", name: "Jean-Pierre", role: "field_worker", deviceId: "device-a", token: "demo-token-jp", orgId: "demo-org" },
  { id: "user-2", email: "fatima@demo.ff", name: "Fatima", role: "field_worker", deviceId: "device-b", token: "demo-token-fatima", orgId: "demo-org" },
  { id: "user-3", email: "dr-amara@demo.ff", name: "Dr. Amara", role: "supervisor", deviceId: "device-c", token: "demo-token-amara", orgId: "demo-org" },
  { id: "user-4", email: "celine@demo.ff", name: "Céline", role: "org_admin", deviceId: "device-admin", token: "demo-token-celine", orgId: "demo-org" },
]
