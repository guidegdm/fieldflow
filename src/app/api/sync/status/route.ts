import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"

export async function GET(request: NextRequest) {
  const auth = await getAuthUser(request)
  if (!auth) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  const deviceId = request.nextUrl.searchParams.get("device_id")
  if (!deviceId) return NextResponse.json({ error: "device_id required" }, { status: 400 })

  const store = getStore()
  const device = store.getDevice(deviceId)
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })

  return NextResponse.json(device)
}
