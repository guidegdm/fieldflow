import { NextResponse } from "next/server"

export async function GET() {
  const counts = { workflows: 1, records: 2, devices: 4, conflicts: 0 }
  return NextResponse.json(counts)
}
