"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type OpStatus = "pending" | "sending" | "acked" | "conflict"

interface SyncOp {
  id: string
  status: OpStatus
}

interface LedgerRow {
  id: string
  horodatage: string
  cle: string
  article: string
  qte: number
  statut: "committed" | "serializationFailure"
  resultat: string
}

interface Device {
  id: string
  user: string
  lastActivity: string
  pending: number
  version: string
  status: "online" | "offline" | "attention"
}

export default function EngineeringPage() {
  const { t } = useTranslation()
  const [devices, setDevices] = useState<Device[]>([])
  const [operations, setOperations] = useState<SyncOp[]>([])
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([])

  useEffect(() => {
    async function loadSnapshot() {
      try {
        const res = await fetch("/api/engineering/snapshot", { credentials: "include" })
        if (!res.ok) return
        const data = await res.json()
        setDevices(data.devices ?? [])
        setOperations(data.operations ?? [])
        setLedgerRows(data.ledger ?? [])
      } catch { /* snapshot is optional */ }
    }
    loadSnapshot()
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const { db } = await import("@/lib/db/indexeddb")
        const [records, mutations] = await Promise.all([
          db.getAllRecords(),
          db.getPendingMutations(),
        ])
        const ops: SyncOp[] = []
        let opIndex = 0
        for (const r of records) {
          const status: OpStatus = r.syncStatus === "synced" ? "acked"
            : r.syncStatus === "conflict" || r.syncStatus === "failed" ? "conflict"
            : "pending"
          ops.push({ id: `op-${String(++opIndex).padStart(3, "0")}`, status })
        }
        for (const m of mutations) {
          ops.push({ id: `op-${String(++opIndex).padStart(3, "0")}`, status: "sending" })
        }
        if (ops.length > 0) setOperations(ops)
      } catch { /* DB not ready */ }
    }
    load()
  }, [])

  const statusConfig: Record<OpStatus, { label: string; ring: string; bg: string }> = {
    pending: { label: "engineering.syncOps.pending", ring: "ring-warning-500", bg: "bg-warning-500" },
    sending: { label: "engineering.syncOps.sending", ring: "ring-info-500", bg: "bg-info-500" },
    acked: { label: "engineering.syncOps.acked", ring: "ring-success-500", bg: "bg-success-500" },
    conflict: { label: "engineering.syncOps.conflict", ring: "ring-rebar", bg: "bg-rebar" },
  }

  const pillConfig = [
    { status: "pending" as OpStatus, count: operations.filter((o) => o.status === "pending").length },
    { status: "sending" as OpStatus, count: operations.filter((o) => o.status === "sending").length },
    { status: "acked" as OpStatus, count: operations.filter((o) => o.status === "acked").length },
    { status: "conflict" as OpStatus, count: operations.filter((o) => o.status === "conflict").length },
  ]

  function LedgerStatusBadge({ statut }: { statut: LedgerRow["statut"] }) {
    if (statut === "committed") {
      return (
        <Badge variant="success" size="sm" className="rounded-none border-0 font-mono text-xs">
          {t("engineering.ledger.committed")}
        </Badge>
      )
    }
    return (
      <Badge variant="danger" size="sm" className="rounded-none border-0 font-mono text-xs">
        {t("engineering.ledger.serializationFailure")}
      </Badge>
    )
  }

  function StatusDot({ deviceStatus }: { deviceStatus: Device["status"] }) {
    const colors = {
      online: "bg-success-500",
      offline: "bg-concrete",
      attention: "bg-warning-500",
    }
    return <span className={cn("inline-block h-2 w-2 rounded-full", colors[deviceStatus])} />
  }

  return (
    <div className="min-h-screen bg-concrete-dark px-4 py-6 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-8 font-display text-3xl text-starlight">Engineering</h1>

        <Tabs defaultValue="sync">
          <TabsList className="border-b-2 border-concrete">
            <TabsTrigger
              value="sync"
              className="aria-selected:border-starlight aria-selected:text-starlight text-concrete hover:text-starlight"
            >
              {t("engineering.tabs.sync")}
            </TabsTrigger>
            <TabsTrigger
              value="ledger"
              className="aria-selected:border-starlight aria-selected:text-starlight text-concrete hover:text-starlight"
            >
              {t("engineering.tabs.inventoryLedger")}
            </TabsTrigger>
            <TabsTrigger
              value="appareils"
              className="aria-selected:border-starlight aria-selected:text-starlight text-concrete hover:text-starlight"
            >
              {t("engineering.tabs.appareils")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sync" className="mt-6">
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {pillConfig.map((p) => {
                const cfg = statusConfig[p.status]
                return (
                  <div
                    key={p.status}
                    className={cn(
                      "flex min-w-0 flex-col items-center border-2 px-3 py-3 text-center sm:px-6",
                      p.status === "pending" && "border-warning-500 text-warning-500",
                      p.status === "sending" && "border-info-500 text-info-500",
                      p.status === "acked" && "border-success-500 text-success-500",
                      p.status === "conflict" && "border-rebar text-rebar",
                    )}
                  >
                    <span className="font-mono text-2xl font-bold">{p.count}</span>
                    <span className="mt-1 max-w-full break-words font-mono text-[10px] uppercase tracking-wide sm:text-xs">
                      {t(cfg.label)}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="border-2 border-concrete p-4">
              <h2 className="mb-4 font-mono text-xs uppercase tracking-wide text-concrete">
                {t("engineering.syncVisualization")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {operations.map((op) => {
                  const cfg = statusConfig[op.status]
                  return (
                    <div
                      key={op.id}
                      title={`${op.id} — ${t(cfg.label)}`}
                      className={cn("h-3 w-3 rounded-full ring-2 ring-offset-1 ring-offset-concrete-dark", cfg.ring, cfg.bg)}
                    />
                  )
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ledger" className="mt-6">
            <div className="overflow-x-auto border-2 border-concrete">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-concrete hover:bg-transparent">
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.ledger.horodatage")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.ledger.cle")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.ledger.article")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.ledger.qte")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.ledger.statut")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.ledger.resultat")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerRows.map((row) => (
                    <TableRow key={row.id} className="border-b-2 border-concrete hover:bg-white/5">
                      <TableCell className="px-4 py-3 font-mono text-xs text-starlight">
                        {row.horodatage}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-starlight">
                        {row.cle}
                      </TableCell>
                      <TableCell className="px-4 py-3 font-mono text-sm text-starlight">
                        {row.article}
                      </TableCell>
                      <TableCell className="px-4 py-3 font-mono text-sm text-starlight">
                        {row.qte}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <LedgerStatusBadge statut={row.statut} />
                      </TableCell>
                      <TableCell className="px-4 py-3 font-mono text-xs text-starlight">
                        {row.resultat}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="appareils" className="mt-6">
            <div className="overflow-x-auto border-2 border-concrete">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-concrete hover:bg-transparent">
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.devices.id")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.devices.user")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.devices.lastActivity")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.devices.pending")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.devices.version")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.devices.status")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id} className="border-b-2 border-concrete hover:bg-white/5">
                      <TableCell className="px-4 py-3 font-mono text-sm text-starlight">
                        {device.id}
                      </TableCell>
                      <TableCell className="px-4 py-3 font-mono text-sm text-starlight">
                        {device.user}
                      </TableCell>
                      <TableCell className="px-4 py-3 font-mono text-xs text-starlight">
                        {device.lastActivity}
                      </TableCell>
                      <TableCell className="px-4 py-3 font-mono text-sm text-starlight">
                        {device.pending}
                      </TableCell>
                      <TableCell className="px-4 py-3 font-mono text-xs text-starlight">
                        {device.version}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-starlight">
                          <StatusDot deviceStatus={device.status} />
                          {t(`engineering.devices.${device.status}`)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
