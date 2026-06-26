import { useState, useEffect } from "react"

interface StorageQuota {
  usage: number
  quota: number
  percentageUsed: number
  isNearLimit: boolean
}

export function useStorageQuota(): StorageQuota {
  const [quota, setQuota] = useState<StorageQuota>({
    usage: 0,
    quota: 0,
    percentageUsed: 0,
    isNearLimit: false,
  })

  useEffect(() => {
    if (!("storage" in navigator) || !("estimate" in navigator.storage)) return

    let cancelled = false

    async function check() {
      const { usage, quota: q } = await navigator.storage.estimate()
      if (cancelled) return
      const usageBytes = usage ?? 0
      const quotaBytes = q ?? 0
      const pct = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0
      setQuota({
        usage: usageBytes,
        quota: quotaBytes,
        percentageUsed: pct,
        isNearLimit: pct >= 80,
      })
    }

    check()
    const id = setInterval(check, 30000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return quota
}
