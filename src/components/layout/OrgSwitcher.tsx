"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/stores/authStore"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { invalidate } from "@/lib/invalidation"
import { WORKSPACE_SECTORS } from "@/lib/workspaces/sectors"

export function OrgSwitcher() {
  const org = useAuthStore((state) => state.org)
  const orgs = useAuthStore((state) => state.orgs)
  const switchOrg = useAuthStore((state) => state.switchOrg)
  const setOrgSwitching = useAuthStore((state) => state.setOrgSwitching)
  const setAuthFromApi = useAuthStore((state) => state.setAuthFromApi)
  const addLocalWorkspace = useAuthStore((state) => state.addLocalWorkspace)
  const [switching, setSwitching] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState("")
  const [workspaceSector, setWorkspaceSector] = useState<(typeof WORKSPACE_SECTORS)[number]>("humanitarian")
  const [createError, setCreateError] = useState("")
  const { t } = useTranslation()

  const invalidateWorkspaceData = () => invalidate(["workflows", "records", "review", "conflicts", "sync", "inventory"])

  const handleChange = async (orgId: string) => {
    const previousOrgId = org?.id
    if (!previousOrgId || previousOrgId === orgId) return
    setOrgSwitching(true)
    switchOrg(orgId)
    invalidateWorkspaceData()
    setSwitching(true)

    try {
      const response = await fetch("/api/auth/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId }),
      })

      if (!response.ok) {
        if (navigator.onLine) {
          switchOrg(previousOrgId)
          invalidateWorkspaceData()
        }
        return
      }

      const data = await response.json()
      if (data.user && data.org) {
        setAuthFromApi(data.user, data.org, data.orgs)
        invalidateWorkspaceData()
      }
    } catch {
      if (navigator.onLine) {
        switchOrg(previousOrgId)
        invalidateWorkspaceData()
      }
    } finally {
      setSwitching(false)
      window.setTimeout(() => setOrgSwitching(false), 240)
    }
  }

  const createLocalWorkspace = (name: string) => {
    const id = `local-workspace-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`
    addLocalWorkspace({ id, name, sector: workspaceSector, role: "org_admin", localOnly: true })
    invalidateWorkspaceData()
  }

  const handleCreateWorkspace = async () => {
    const name = workspaceName.trim()
    if (!name) {
      setCreateError(t("common.required", "Required"))
      return
    }
    setCreating(true)
    setCreateError("")
    setOrgSwitching(true)

    try {
      if (!navigator.onLine) {
        createLocalWorkspace(name)
      } else {
        const response = await fetch("/api/auth/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, sector: workspaceSector }),
        })
        if (!response.ok) throw new Error("workspace_create_failed")
        const data = await response.json()
        if (data.user && data.org) setAuthFromApi(data.user, data.org, data.orgs)
        invalidateWorkspaceData()
      }
      setCreateOpen(false)
      setWorkspaceName("")
      setWorkspaceSector("humanitarian")
    } catch {
      if (!navigator.onLine) {
        createLocalWorkspace(name)
        setCreateOpen(false)
        setWorkspaceName("")
      } else {
        setCreateError(t("workspace.createError", "Unable to create workspace"))
      }
    } finally {
      setCreating(false)
      window.setTimeout(() => setOrgSwitching(false), 240)
    }
  }

  if (!org) return null
  const options = orgs.length ? orgs : [org]

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-pencil">
        {t("workspace.current", "Workspace")}
      </p>
      <Select
        value={org.id}
        onChange={(event) => handleChange(event.target.value)}
        aria-label={t("workspace.switch", "Switch workspace")}
        className="h-9 text-xs"
        disabled={switching}
      >
        {options.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name || candidate.id}{candidate.role ? ` - ${t(`roles.${candidate.role}`, candidate.role)}` : ""}
            {candidate.localOnly ? ` (${t("workspace.localOnly", "local")})` : ""}
          </option>
        ))}
      </Select>
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="text-xs font-semibold text-ink-blue transition-colors hover:text-ink-blue/80"
      >
        {t("workspace.create", "Create workspace")}
      </button>

      {createOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6">
          <button
            type="button"
            className="absolute inset-0 bg-ink-black/35 backdrop-blur-sm"
            aria-label={t("common.close", "Close")}
            onClick={() => !creating && setCreateOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-graph-line bg-white p-5 shadow-2xl">
            <div>
              <p className="font-display text-2xl font-semibold tracking-tight text-lake-deep">
                {t("workspace.createTitle", "Create workspace")}
              </p>
              <p className="mt-1 text-sm leading-6 text-pencil">
                {t("workspace.createHelp", "Use workspaces to manage separate projects, teams, or clients from the same account. You will be the administrator.")}
              </p>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="new-workspace-name" className="mb-1 block text-sm font-medium text-soil">
                  {t("workspace.name", "Workspace name")}
                </label>
                <input
                  id="new-workspace-name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  className="h-11 w-full rounded-md border border-graph-line px-3 text-base focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ink-blue sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="new-workspace-sector" className="mb-1 block text-sm font-medium text-soil">
                  {t("workspace.sector", "Workspace sector")}
                </label>
                <Select
                  id="new-workspace-sector"
                  value={workspaceSector}
                  onChange={(event) => setWorkspaceSector(event.target.value as (typeof WORKSPACE_SECTORS)[number])}
                >
                  {WORKSPACE_SECTORS.map((sector) => (
                    <option key={sector} value={sector}>
                      {t(`signup.sectors.${sector}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {createError && <p className="mt-3 text-sm text-danger-500">{createError}</p>}
            {typeof navigator !== "undefined" && !navigator.onLine && (
              <p className="mt-3 rounded-md border border-graph-line bg-graph-paper px-3 py-2 text-xs leading-5 text-pencil">
                {t("workspace.offlineCreateNote", "Offline workspaces stay on this device until you create a cloud workspace online.")}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="button" loading={creating} onClick={handleCreateWorkspace}>
                {t("workspace.createSubmit", "Create")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
