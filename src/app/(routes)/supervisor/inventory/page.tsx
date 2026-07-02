"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Package, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { apiPost, apiGet } from "@/lib/api/client"
import { useAuthStore } from "@/stores/authStore"
import { db } from "@/lib/db/indexeddb"

type InventoryItem = {
  itemId: string
  label: string
  total: number
  available: number
}

export default function SupervisorInventory() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (user?.orgId) {
        const cached = await db.getProjection<InventoryItem[]>(`inventory:${user.orgId}`).catch(() => undefined)
        if (!cancelled && cached) {
          setItems(cached)
          setPageLoading(false)
        }
      }
      try {
        const data = await apiGet<InventoryItem[]>("/api/critical/inventory")
        if (cancelled) return
        setItems(data)
        if (user?.orgId) {
          void db.putProjection(`inventory:${user.orgId}`, data, user.orgId)
        }
        setPageLoading(false)
        return
      } catch {
        if (!user?.orgId) {
          setItems([])
        }
      }
      if (!cancelled) setPageLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user?.orgId])

  const handleReserve = async (itemId: string) => {
    setLoading(itemId)
    setFeedback(null)
    const key = `${itemId}-${crypto.randomUUID()}`
    try {
      const res = await apiPost<{ success: boolean; error?: string }>("/api/critical/inventory/reserve", {
        item_id: itemId,
        idempotency_key: key,
        quantity: 1,
      })
      if (res.success) {
        const nextItems = items.map((i) => (i.itemId === itemId ? { ...i, available: i.available - 1 } : i))
        setItems(nextItems)
        if (user?.orgId) void db.putProjection(`inventory:${user.orgId}`, nextItems, user.orgId)
        setFeedback({ type: "success", message: t("inventory.reserveSuccess") })
      } else {
        setFeedback({ type: "danger", message: res.error || t("inventory.reserveFailed") })
      }
    } catch {
      setFeedback({ type: "danger", message: t("inventory.reserveFailed") })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-iodine-brown tracking-tight">{t("dashboard.inventory")}</h1>
        <p className="text-sm text-chart-gray mt-1">{items.reduce((s, i) => s + i.available, 0)} {t("inventory.unitsAvailable")}</p>
      </div>

      <Alert variant="info" className="border-scrub-blue/20 bg-scrub-blue/5">
        <Info className="text-scrub-blue" />
        <AlertTitle className="text-scrub-blue">{t("inventory.whyTitle")}</AlertTitle>
        <AlertDescription className="text-iodine-brown">
          {t("inventory.whyBody")}
        </AlertDescription>
      </Alert>

      {feedback && (
        <Alert variant={feedback.type}>
          {feedback.type === "success" ? <CheckCircle2 /> : <XCircle />}
          <AlertTitle>{feedback.type === "success" ? t("common.success") : t("common.error")}</AlertTitle>
          <AlertDescription>{feedback.message}</AlertDescription>
        </Alert>
      )}

      {pageLoading ? (
        <div className="grid gap-4 animate-pulse sm:grid-cols-2">
          {[1, 2].map(i => (
            <div key={i} className="h-52 bg-graph-line rounded-lg" />
          ))}
        </div>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const pct = item.total > 0 ? Math.round((item.available / item.total) * 100) : 0
          const isLow = item.available < 2
          return (
            <Card key={item.itemId} className={`min-w-0 border-graph-line ${isLow ? "border-danger-500/30" : ""}`}>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center ${isLow ? "bg-danger-500/10" : "bg-scrub-blue/10"}`}>
                      <Package size={20} className={isLow ? "text-danger-500" : "text-scrub-blue"} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-iodine-brown">{item.label}</p>
                      <p className="text-xs text-chart-gray">
                        {t("inventory.available")}: {item.available} / {t("inventory.total")}: {item.total}
                      </p>
                    </div>
                  </div>
                  <Badge variant={isLow ? "danger" : "success"} size="sm" className="-rotate-1 border shadow-sm shrink-0">
                    {isLow ? t("inventory.outOfStock") : t("inventory.available")}
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-chart-gray">
                    <span>{pct}%</span>
                    <span>{item.available}/{item.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-graph-line overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isLow ? "bg-danger-500" : "bg-antiseptic-green"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {isLow && (
                  <div className="flex items-center gap-1.5 text-xs text-danger-500">
                    <AlertTriangle size={12} />
                    <span>{t("inventory.lowStock")}</span>
                  </div>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  className="w-full bg-scrub-blue hover:bg-scrub-blue/90"
                  loading={loading === item.itemId}
                  disabled={item.available === 0}
                  onClick={() => handleReserve(item.itemId)}
                >
                  {t("supervisor.reserve")}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
      )}
    </div>
  )
}
