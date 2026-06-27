"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { DEMO_USERS } from "@/types/auth"

type OpStatus = "pending" | "sending" | "acked" | "conflict"

interface SyncOp {
  id: string
  status: OpStatus
}

interface DsqlRow {
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

// TODO: fetch from sync API

// TODO: fetch from DSQL ledger API
const dsqlLedger: DsqlRow[] = [
  {
    id: "tx-001",
    horodatage: "2024-03-15 14:32:18.142",
    cle: "idem-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    article: "Riz 25kg",
    qte: 10,
    statut: "committed",
    resultat: "Réservé — solde: 90",
  },
  {
    id: "tx-002",
    horodatage: "2024-03-15 14:32:19.001",
    cle: "idem-b2c3d4e5-f6a7-8901-bcde-f12345678901",
    article: "Huile 1L",
    qte: 25,
    statut: "committed",
    resultat: "Réservé — solde: 75",
  },
  {
    id: "tx-003",
    horodatage: "2024-03-15 14:32:20.887",
    cle: "idem-c3d4e5f6-a7b8-9012-cdef-123456789012",
    article: "Tentes famille",
    qte: 5,
    statut: "serializationFailure",
    resultat: "ÉCHEC — conflit version ligne",
  },
  {
    id: "tx-004",
    horodatage: "2024-03-15 14:32:22.413",
    cle: "idem-d4e5f6a7-b8c9-0123-defa-234567890123",
    article: "Riz 25kg",
    qte: 15,
    statut: "committed",
    resultat: "Réservé — solde: 75",
  },
]

export default function EngineeringPage() {
  const { t } = useTranslation()
  const [devices, setDevices] = useState<Device[]>([])
  const [operations, setOperations] = useState<SyncOp[]>([])

  useEffect(() => {
    setDevices(DEMO_USERS.map((u, i) => ({
      id: u.deviceId,
      user: u.name,
      lastActivity: i < 2 ? new Date().toISOString().slice(0, 16).replace("T", " ") : "2024-03-15 12:15",
      pending: i === 1 ? 0 : 2,
      version: "2.1.0",
      status: (i < 2 ? "online" : i === 2 ? "attention" : "offline") as Device["status"],
    })))
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
        setOperations(ops)
      } catch { /* DB not ready */ }
    }
    load()
  }, [])

  const statusConfig: Record<OpStatus, { label: string; ring: string; bg: string }> = {
    pending: { label: "engineering.syncOps.pending", ring: "ring-[#F59E0B]", bg: "bg-[#F59E0B]" },
    sending: { label: "engineering.syncOps.sending", ring: "ring-blue-500", bg: "bg-blue-500" },
    acked: { label: "engineering.syncOps.acked", ring: "ring-success-500", bg: "bg-success-500" },
    conflict: { label: "engineering.syncOps.conflict", ring: "ring-rebar", bg: "bg-rebar" },
  }

  const pillConfig = [
    { status: "pending" as OpStatus, count: operations.filter((o) => o.status === "pending").length },
    { status: "sending" as OpStatus, count: operations.filter((o) => o.status === "sending").length },
    { status: "acked" as OpStatus, count: operations.filter((o) => o.status === "acked").length },
    { status: "conflict" as OpStatus, count: operations.filter((o) => o.status === "conflict").length },
  ]

  function DsqlStatusBadge({ statut }: { statut: DsqlRow["statut"] }) {
    if (statut === "committed") {
      return (
        <Badge variant="success" size="sm" className="rounded-none border-0 font-mono text-xs">
          {t("engineering.dsql.committed")}
        </Badge>
      )
    }
    return (
      <Badge variant="danger" size="sm" className="rounded-none border-0 font-mono text-xs">
        {t("engineering.dsql.serializationFailure")}
      </Badge>
    )
  }

  function StatusDot({ deviceStatus }: { deviceStatus: Device["status"] }) {
    const colors = {
      online: "bg-success-500",
      offline: "bg-concrete",
      attention: "bg-[#F59E0B]",
    }
    return <span className={cn("inline-block h-2 w-2 rounded-full", colors[deviceStatus])} />
  }

  return (
    <div className="min-h-screen bg-concrete-dark p-6">
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
              value="dsql"
              className="aria-selected:border-starlight aria-selected:text-starlight text-concrete hover:text-starlight"
            >
              {t("engineering.tabs.dsqlLedger")}
            </TabsTrigger>
            <TabsTrigger
              value="appareils"
              className="aria-selected:border-starlight aria-selected:text-starlight text-concrete hover:text-starlight"
            >
              {t("engineering.tabs.appareils")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sync" className="mt-6">
            <div className="mb-8 flex gap-4">
              {pillConfig.map((p) => {
                const cfg = statusConfig[p.status]
                return (
                  <div
                    key={p.status}
                    className={cn(
                      "flex flex-col items-center border-2 px-6 py-3",
                      p.status === "pending" && "border-[#F59E0B] text-[#F59E0B]",
                      p.status === "sending" && "border-blue-500 text-blue-400",
                      p.status === "acked" && "border-success-500 text-success-500",
                      p.status === "conflict" && "border-rebar text-rebar",
                    )}
                  >
                    <span className="font-mono text-2xl font-bold">{p.count}</span>
                    <span className="mt-1 font-mono text-xs uppercase tracking-wide">
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

          <TabsContent value="dsql" className="mt-6">
            <div className="border-2 border-concrete">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-concrete hover:bg-transparent">
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.dsql.horodatage")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.dsql.cle")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.dsql.article")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.dsql.qte")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.dsql.statut")}
                    </TableHead>
                    <TableHead className="bg-concrete-dark px-4 py-3 font-mono text-xs uppercase tracking-wide text-concrete">
                      {t("engineering.dsql.resultat")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dsqlLedger.map((row) => (
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
                        <DsqlStatusBadge statut={row.statut} />
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
            <div className="border-2 border-concrete">
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
