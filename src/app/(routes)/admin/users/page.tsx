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
import { UserPlus, X, ChevronDown, Check } from "lucide-react"

interface UserRow {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
}

const ROLES: { value: UserRole; label: string; labelEn: string }[] = [
  { value: "field_worker", label: "Agent terrain", labelEn: "Field Agent" },
  { value: "supervisor", label: "Superviseur", labelEn: "Supervisor" },
  { value: "org_admin", label: "Administrateur", labelEn: "Admin" },
]

export default function AdminUsersPage() {
  const { t, i18n } = useTranslation()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("field_worker")
  const [editingRole, setEditingRole] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/users", { credentials: "include" })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setUsers(data.map((u: UserRow & { userId?: string }) => ({
        id: u.id || u.userId || u.email,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active !== false,
      }))))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  const handleInvite = () => {
    if (!inviteEmail) return
    const newUser: UserRow = {
      id: crypto.randomUUID(),
      name: inviteEmail.split("@")[0],
      email: inviteEmail,
      role: inviteRole,
      active: true,
    }
    setUsers((prev) => [...prev, newUser])
    setInviteOpen(false)
    setInviteEmail("")
    setInviteRole("field_worker")
  }

  const handleRoleChange = (userId: string, role: UserRole) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    setEditingRole(null)
  }

  const handleToggleActive = (userId: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: !u.active } : u)))
  }

  const isFr = i18n.language === "fr"

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg border border-graph-line bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ink-black">{t("admin.inviteTitle")}</h2>
              <button onClick={() => setInviteOpen(false)} className="text-pencil hover:text-ink-black">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
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
                <Button variant="primary" onClick={handleInvite} disabled={!inviteEmail}>
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
                    <Badge variant={u.active ? "success" : "default"} size="sm">
                      {u.active ? t("admin.active") : t("admin.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(u.id)}
                    >
                      {u.active ? t("admin.deactivate") : "Activer"}
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
