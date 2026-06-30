import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    process.env.npm_package_version ||
    "local"

  return NextResponse.json(
    {
      version,
      checkedAt: Date.now(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  )
}
