import { NextResponse } from "next/server"
import { clearAccessCookie, clearRefreshCookie, clearSessionCookie } from "@/lib/auth/middleware"

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.headers.set("Set-Cookie", clearAccessCookie())
  response.headers.append("Set-Cookie", clearRefreshCookie())
  response.headers.append("Set-Cookie", clearSessionCookie())
  return response
}
