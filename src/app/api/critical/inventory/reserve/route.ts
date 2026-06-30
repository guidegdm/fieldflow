import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"
import { hasRoleAccess } from "@/lib/auth/roles"

const reserveSchema = z.object({
  item_id: z.string().min(1),
  idempotency_key: z.string().min(1),
  quantity: z.number().int().min(1).max(100).default(1),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  if (!hasRoleAccess(user.role, "supervisor")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  let body: z.infer<typeof reserveSchema>
  try {
    body = reserveSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }

  const store = getStore()
  const result = await store.reserveInventoryForOrg(body.item_id, body.idempotency_key, body.quantity, user.sub, user.orgId)

  if (!result.success) {
    return NextResponse.json(result, { status: result.error === "ITEM_NOT_FOUND" ? 404 : 409 })
  }

  return NextResponse.json(result)
}
