import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("device_id")
  if (!deviceId) return NextResponse.json({ error: "device_id required" }, { status: 400 })

  const store = getStore()
  const device = store.getDevice(deviceId)
  if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 })

  return NextResponse.json(device)
}
