import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  if (user.role !== "org_admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const users = await getStore().getUsersByOrg(user.orgId)
  return NextResponse.json(users)
}
