"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { UserRole } from "@/types/auth"
import { Loader2, UserPlus, X, ChevronDown, Check } from "lucide-react"
import { db } from "@/lib/db/indexeddb"
import { useAuthStore } from "@/stores/authStore"

interface UserRow {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  invited?: boolean
  inviteStatus?: "pending" | "accepted" | "inactive" | "expired" | string
  delivery?: string
}

const ROLES: { value: UserRole; label: string; labelEn: string }[] = [
  { value: "field_worker", label: "Agent terrain", labelEn: "Field Agent" },
  { value: "supervisor", label: "Superviseur", labelEn: "Supervisor" },
  { value: "org_admin", label: "Administrateur", labelEn: "Admin" },
]

export default function AdminUsersPage() {
  const { t, i18n } = useTranslation()
  const orgId = useAuthStore((state) => state.user?.orgId)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("field_worker")
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState("")

  useEffect(() => {
    let cancelled = false
    const projectionKey = orgId ? `admin-users:${orgId}` : null
    async function loadLocal() {
      if (!projectionKey) return
      const local = await db.getProjection<UserRow[]>(projectionKey).catch(() => undefined)
      if (!cancelled && local?.length) {
        setUsers(local)
        setLoading(false)
      }
    }
    void loadLocal()
    fetch("/api/admin/users", { credentials: "include" })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => data.map((u: UserRow & { userId?: string }) => ({
        id: u.id || u.userId || u.email,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active !== false,
        invited: Boolean(u.invited),
        inviteStatus: u.inviteStatus,
        delivery: u.delivery,
      })))
      .then((nextUsers) => {
        if (cancelled) return
        setUsers(nextUsers)
        if (projectionKey) void db.putProjection(projectionKey, nextUsers, orgId)
      })
      .catch(() => {
        if (!cancelled && !projectionKey) setUsers([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [orgId])

  const handleInvite = async () => {
    if (!inviteEmail) return
    setInviteBusy(true)
    setInviteError("")
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      if (!res.ok) throw new Error("invite_failed")
      const user = await res.json()
      const newUser: UserRow = {
        id: user.id || user.userId || user.email,
        name: user.name || user.email,
        email: user.email,
        role: user.role,
        active: user.active !== false,
        invited: Boolean(user.invited),
        inviteStatus: user.inviteStatus,
        delivery: user.delivery,
      }
      const nextUsers = [newUser, ...users.filter((item) => item.email !== newUser.email)]
      setUsers(nextUsers)
      if (orgId) void db.putProjection(`admin-users:${orgId}`, nextUsers, orgId)
      setInviteOpen(false)
      setInviteEmail("")
      setInviteRole("field_worker")
    } catch {
      setInviteError(t("admin.inviteFailed", "Invitation could not be sent."))
    } finally {
      setInviteBusy(false)
    }
  }

  const persistUser = async (email: string, updates: Partial<Pick<UserRow, "role" | "active">>) => {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, ...updates }),
    })
    if (!res.ok) throw new Error("user_update_failed")
    return res.json()
  }

  const handleRoleChange = async (userId: string, role: UserRole) => {
    const current = users.find((u) => u.id === userId)
    if (!current) return
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    setEditingRole(null)
    try {
      const updated = await persistUser(current.email, { role })
      const nextUsers = users.map((u) => (u.id === userId ? { ...u, ...updated, id: updated.id || updated.userId || updated.email } : u))
      setUsers(nextUsers)
      if (orgId) void db.putProjection(`admin-users:${orgId}`, nextUsers, orgId)
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: current.role } : u)))
      setInviteError(t("admin.userUpdateFailed", "User could not be updated."))
    }
  }

  const handleToggleActive = async (userId: string) => {
    const current = users.find((u) => u.id === userId)
    if (!current) return
    const nextActive = !current.active
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: nextActive, inviteStatus: nextActive ? "accepted" : "inactive" } : u)))
    try {
      const updated = await persistUser(current.email, { active: nextActive })
      const nextUsers = users.map((u) => (u.id === userId ? { ...u, ...updated, id: updated.id || updated.userId || updated.email } : u))
      setUsers(nextUsers)
      if (orgId) void db.putProjection(`admin-users:${orgId}`, nextUsers, orgId)
    } catch {
      setUsers((prev) => prev.map((u) => (u.id === userId ? current : u)))
      setInviteError(t("admin.userUpdateFailed", "User could not be updated."))
    }
  }

  const isFr = i18n.language === "fr"

  const statusFor = (user: UserRow) => {
    if (user.inviteStatus === "pending" || (user.invited && !user.active)) return {
      label: t("admin.invited", "Invited"),
      variant: "warning" as const,
    }
    if (user.active) return { label: t("admin.active"), variant: "success" as const }
    return { label: t("admin.inactive"), variant: "default" as const }
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-4xl text-lake-deep tracking-tight">{t("admin.users")}</h1>
        <Button variant="primary" onClick={() => setInviteOpen(true)} className="w-full sm:w-auto">
          <UserPlus size={16} />
          {t("admin.inviteUser")}
        </Button>
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex min-h-dvh items-start justify-center overflow-y-auto bg-black/40 px-4 py-6 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-lg border border-graph-line bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ink-black">{t("admin.inviteTitle")}</h2>
              <button onClick={() => setInviteOpen(false)} className="text-pencil hover:text-ink-black">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              {inviteError && (
                <div className="rounded-md border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
                  {inviteError}
                </div>
              )}
              <Input
                label={t("admin.inviteEmail")}
                type="email"
                placeholder="exemple@fieldflow.app"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-pencil mb-1">
                  {t("admin.inviteRole")}
                </label>
                <Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {isFr ? r.label : r.labelEn}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setInviteOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button variant="primary" onClick={handleInvite} disabled={!inviteEmail || inviteBusy}>
                  {inviteBusy && <Loader2 size={14} className="animate-spin" />}
                  {t("admin.inviteSubmit")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-full overflow-x-auto border-2 border-volcanic-ash">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-volcanic-ash">
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.name")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.email")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("auth.role")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.status")}</TableHead>
              <TableHead className="bg-kivu-paper text-[11px] uppercase tracking-[0.1em] text-soil font-semibold">{t("admin.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3, 4].map((i) => (
                <TableRow key={i} className="border-b-2 border-volcanic-ash">
                  <TableCell colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow className="border-b-2 border-volcanic-ash">
                <TableCell colSpan={5} className="text-center py-8 text-pencil">
                  {t("admin.noUsers")}
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id} className="border-b-2 border-volcanic-ash">
                  <TableCell className="font-medium text-ink-black">{u.name}</TableCell>
                  <TableCell className="text-pencil">{u.email}</TableCell>
                  <TableCell>
                    {editingRole === u.id ? (
                      <div className="flex items-center gap-1">
                        <Select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="h-8 px-2 text-xs"
                          autoFocus
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {isFr ? r.label : r.labelEn}
                            </option>
                          ))}
                        </Select>
                        <button onClick={() => setEditingRole(null)} className="text-pencil hover:text-ink-black">
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-ink-black">
                          {isFr ? ROLES.find((r) => r.value === u.role)?.label : ROLES.find((r) => r.value === u.role)?.labelEn}
                        </span>
                        <button onClick={() => setEditingRole(u.id)} className="text-pencil hover:text-ink-black ml-1">
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusFor(u).variant} size="sm">
                      {statusFor(u).label}
                    </Badge>
                    {u.delivery === "existing_account_linked" && (
                      <p className="mt-1 text-xs text-pencil">{t("admin.existingAccountLinked", "Existing account linked")}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(u.id)}
                    >
                      {u.active ? t("admin.deactivate") : t("admin.activate", "Activate")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
