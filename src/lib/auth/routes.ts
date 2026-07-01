export function dashboardForRole(role: string | undefined | null) {
  if (role === "org_admin") return "/admin/dashboard"
  if (role === "supervisor") return "/supervisor/dashboard"
  return "/field-worker/home"
}
