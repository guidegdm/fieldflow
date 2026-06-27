"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Package, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { apiPost, apiGet } from "@/lib/api/client"

type InventoryItem = {
  itemId: string
  label: string
  total: number
  available: number
}

export default function SupervisorInventory() {
  const { t } = useTranslation()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await apiGet<InventoryItem[]>("/api/critical/inventory")
        setItems(data)
        setPageLoading(false)
        return
      } catch { setItems([]) }
      setPageLoading(false)
    }
    load()
  }, [])

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
        setItems((prev) => prev.map((i) => (i.itemId === itemId ? { ...i, available: i.available - 1 } : i)))
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
        <AlertTitle className="text-scrub-blue">Pourquoi un inventaire ?</AlertTitle>
        <AlertDescription className="text-iodine-brown">
          Dans un camp de 1 200 familles avec seulement 50 kits d&apos;aide, chaque allocation doit &ecirc;tre
          atomique. Deux travailleurs ne peuvent pas r&eacute;server le dernier kit simultan&eacute;ment.
          FieldFlow utilise DynamoDB avec des cl&eacute;s d&apos;idempotence et des mises &agrave; jour
          conditionnelles pour garantir qu&apos;un article n&apos;est jamais allou&eacute; deux fois &mdash;
          m&ecirc;me si deux superviseurs approuvent en m&ecirc;me temps depuis des appareils diff&eacute;rents.
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
        <div className="grid grid-cols-2 gap-4 animate-pulse">
          {[1, 2].map(i => (
            <div key={i} className="h-52 bg-graph-line rounded-lg" />
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-4">
        {items.map((item) => {
          const pct = item.total > 0 ? Math.round((item.available / item.total) * 100) : 0
          const isLow = item.available < 2
          return (
            <Card key={item.itemId} className={`border-graph-line ${isLow ? "border-danger-500/30" : ""}`}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center ${isLow ? "bg-danger-500/10" : "bg-scrub-blue/10"}`}>
                      <Package size={20} className={isLow ? "text-danger-500" : "text-scrub-blue"} />
                    </div>
                    <div>
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
