import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"

export async function POST(request: NextRequest) {
  const { item_id, idempotency_key, quantity = 1 } = await request.json()
  if (!item_id || !idempotency_key) {
    return NextResponse.json({ error: "item_id and idempotency_key required" }, { status: 400 })
  }

  const store = getStore()
  const result = await store.reserveInventory(item_id, idempotency_key, quantity)

  if (!result.success) {
    return NextResponse.json(result, { status: 409 })
  }

  return NextResponse.json(result)
}
