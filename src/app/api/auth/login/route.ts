import { NextResponse } from "next/server"
import { DEMO_USERS } from "@/types/auth"
import { setSessionCookie } from "@/lib/auth/middleware"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    const user = DEMO_USERS.find((u) => u.email === email)
    if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 401 })
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, deviceId: user.deviceId },
    })
    response.headers.set("Set-Cookie", setSessionCookie(user.token))
    return response
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 })
  }
}
