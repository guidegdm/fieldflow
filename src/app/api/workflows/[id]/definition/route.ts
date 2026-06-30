import { NextRequest, NextResponse } from "next/server"
import { getStore } from "@/lib/api/in-memory-store"
import { getAuthUser } from "@/lib/auth/middleware"
import type { WorkflowDefinition } from "@/types/workflow"
import { validateWorkflowDefinition, workflowValidationResponse } from "@/lib/workflows/validate-definition"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const { id } = await params
  const store = getStore()
  const workflow = await store.getWorkflowForOrgAsync(id, user.orgId)
  if (!workflow) return NextResponse.json(null)
  return NextResponse.json(workflow)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  if (user.role !== "org_admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const { id } = await params
  const payload = await request.json().catch(() => null) as Partial<WorkflowDefinition> | null
  if (!payload) return NextResponse.json({ error: "Invalid workflow payload" }, { status: 400 })

  const now = new Date().toISOString()
  const workflow: WorkflowDefinition = {
    ...payload,
    id,
    orgId: user.orgId,
    version: payload.version ?? 1,
    name: payload.name?.trim() || "Nouveau workflow",
    nameEn: payload.nameEn?.trim() || payload.name?.trim() || "New workflow",
    description: payload.description ?? "",
    descriptionEn: payload.descriptionEn ?? "",
    entity: payload.entity ?? { id: "entity-1", key: "record", label: "Fiche", labelEn: "Record", fields: [] },
    states: payload.states ?? [],
    transitions: payload.transitions ?? [],
    roles: payload.roles ?? [],
    offlinePolicy: payload.offlinePolicy ?? {
      maxOfflineHours: 72,
      allowedOperations: { create: true, update: true, delete: false, evidence: true },
      conflictStrategy: "manual",
      manualResolutionFields: [],
      autoResolutionNumeric: "max",
      maxAttachmentSizeMb: 10,
      allowedAttachmentTypes: ["image/jpeg", "image/png", "application/pdf"],
      attachmentSyncPriority: "deferred",
    },
    status: payload.status === "published" ? "published" : "draft",
    createdAt: payload.createdAt ?? now,
    updatedAt: now,
    publishedAt: payload.publishedAt,
    author: payload.author ?? user.email,
    expiresAt: payload.expiresAt,
  }

  const store = getStore()
  const errors = validateWorkflowDefinition(workflow)
  if (errors.length > 0) return NextResponse.json(workflowValidationResponse(errors), { status: 422 })

  await store.putWorkflowForOrg(workflow)
  return NextResponse.json(workflow)
}
