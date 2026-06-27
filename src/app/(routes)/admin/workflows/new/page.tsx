"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { generateId } from "@/lib/utils"

export default function NewWorkflowRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace(`/admin/workflows/${generateId()}`)
  }, [router])

  return null
}
