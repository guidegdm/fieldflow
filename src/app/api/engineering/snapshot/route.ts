import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const store = getStore()
  const [devices, records, conflicts, ledger] = await Promise.all([
    store.getDevicesByOrgAsync(user.orgId),
    store.getAllRecordsForOrg(user.orgId),
    store.getOpenConflictsForOrg(user.orgId),
    store.getInventoryLedgerByOrg(user.orgId),
  ])

  const operations = records.map((record, index) => ({
    id: `rec-${String(index + 1).padStart(3, "0")}`,
    status: record.syncStatus === "synced" ? "acked"
      : record.syncStatus === "conflict" || record.syncStatus === "failed" ? "conflict"
      : "pending",
  }))

  return NextResponse.json({
    devices: devices.map((device) => ({
      id: device.device_id,
      user: device.user_id,
      lastActivity: device.last_sync_at ? new Date(device.last_sync_at).toISOString() : "",
      pending: device.pending_count,
      version: String(device.workflow_version),
      status: device.pending_count > 0 ? "attention" : "online",
    })),
    operations,
    conflicts: conflicts.length,
    ledger: ledger.map((entry) => ({
      id: entry.id,
      horodatage: new Date(entry.timestamp).toISOString(),
      cle: entry.idempotencyKey,
      article: entry.itemId,
      qte: entry.quantity,
      statut: entry.status === "committed" ? "committed" : "serializationFailure",
      resultat: entry.status === "committed" ? "Reserved" : "Serialization failure",
    })),
  })
}
