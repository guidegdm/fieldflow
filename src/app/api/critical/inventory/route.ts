import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (!auth) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const store = getStore()
  const items = store.getInventoryItems().map((item) => ({
    itemId: item.id,
    label: item.name,
    total: item.total,
    available: item.total - item.reserved,
  }))
  return NextResponse.json(items)
}
