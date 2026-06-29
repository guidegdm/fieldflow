import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { DEMO_USERS } from "@/types/auth"
import { getOrCreateDemoInstall, setDemoInstallCookie } from "@/lib/auth/middleware"
import { checkRateLimit } from "@/lib/auth/rate-limit"
import { seedIsolatedDemoOrg } from "@/lib/demo/seed-demo-org"

export async function GET(request: NextRequest) {
  try {
    const rate = checkRateLimit(request, "demo-offline-warmup", 12, 60_000)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many warmup attempts." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      )
    }

    const demoInstall = getOrCreateDemoInstall(request)
    const adminPersona = DEMO_USERS.find((user) => user.role === "org_admin") ?? DEMO_USERS[0]
    const seeded = await seedIsolatedDemoOrg(adminPersona, demoInstall.installId, "AHK")

    const response = NextResponse.json({
      installId: demoInstall.installId.slice(0, 12),
      expiresAt: seeded.expiresAt,
      seedCounts: seeded.seedCounts,
      offlineWorkspaces: seeded.offlineWorkspaces,
      offlineAccounts: seeded.offlineAccounts,
    })
    response.headers.set("Set-Cookie", setDemoInstallCookie(demoInstall.token))
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch (error) {
    console.error("[demo/offline] warmup failed", error)
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
