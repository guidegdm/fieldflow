"use client"

import { useState } from "react"
import { useAuthStore } from "@/stores/authStore"
import { Select } from "@/components/ui/select"

export function OrgSwitcher() {
  const org = useAuthStore((state) => state.org)
  const orgs = useAuthStore((state) => state.orgs)
  const switchOrg = useAuthStore((state) => state.switchOrg)
  const setAuthFromApi = useAuthStore((state) => state.setAuthFromApi)
  const [switching, setSwitching] = useState(false)

  const handleChange = async (orgId: string) => {
    const previousOrgId = org?.id
    switchOrg(orgId)
    setSwitching(true)

    try {
      const response = await fetch("/api/auth/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orgId }),
      })

      if (!response.ok) {
        if (previousOrgId) switchOrg(previousOrgId)
        return
      }

      const data = await response.json()
      if (data.user && data.org) setAuthFromApi(data.user, data.org, data.orgs)
    } finally {
      setSwitching(false)
    }
  }

  if (!org) return null
  if (orgs.length <= 1) {
    return <p className="text-xs font-medium text-lake-deep truncate">{org.name || "Organisation"}</p>
  }

  return (
    <Select
      value={org.id}
      onChange={(event) => handleChange(event.target.value)}
      aria-label="Organisation"
      className="h-9 text-xs"
      disabled={switching}
    >
      {orgs.map((candidate) => (
        <option key={candidate.id} value={candidate.id}>
          {candidate.name || candidate.id}
        </option>
      ))}
    </Select>
  )
}
