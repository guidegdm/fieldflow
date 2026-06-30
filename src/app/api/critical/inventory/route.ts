import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"
import { hasRoleAccess } from "@/lib/auth/roles"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  if (!hasRoleAccess(user.role, "supervisor")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const items = await getStore().getInventoryItemsForOrg(user.orgId)
  return NextResponse.json(items.map((item) => ({
    itemId: item.id,
    label: item.name,
    total: item.total,
    available: item.total - item.reserved,
  })))
}
