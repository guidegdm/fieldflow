"use client"

import { db } from "@/lib/db/indexeddb"
import type { DemoUser } from "@/types/auth"
import type { RecordData } from "@/types/record"
import type { ConflictRecord } from "@/types/sync"
import type { WorkflowDefinition } from "@/types/workflow"

type WorkflowListItem = WorkflowDefinition & { recordCount?: number }
export interface DemoOfflineWorkspace {
  orgId: string
  workflows: WorkflowDefinition[]
  records: RecordData[]
  conflicts?: ConflictRecord[]
}

async function getJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, { credentials: "include", signal: controller.signal })
    if (!response.ok) return null
    return response.json() as Promise<T>
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
  }
}

async function writeWorkspace(user: DemoUser, workspace: DemoOfflineWorkspace) {
  await db.replaceWorkflowsForOrg(workspace.orgId, workspace.workflows)
  await db.replaceRecordsForOrg(workspace.orgId, workspace.records)
  await db.replaceConflictsForRecords(workspace.records.map((record) => record.id), Array.isArray(workspace.conflicts) ? workspace.conflicts : [])

  if (workspace.orgId === user.orgId) {
    await db.updateDeviceState({
      device_id: user.deviceId,
      user_id: user.id,
      orgId: user.orgId,
      workflow_id: workspace.workflows[0]?.id || "wf-1",
      workflow_version: workspace.workflows[0]?.version || 1,
      version: workspace.workflows[0]?.version || 1,
      last_seq: 0,
      last_sync_at: Date.now(),
      pending_count: 0,
    })
  }
}

export async function hydrateDemoWorkspaceOffline(user: DemoUser, workspaces?: DemoOfflineWorkspace[]) {
  if (!user.orgId) return { workflows: 0, records: 0, conflicts: 0, workspaces: 0 }

  if (workspaces?.length) {
    let workflows = 0
    let records = 0
    let conflicts = 0
    for (const workspace of workspaces) {
      await writeWorkspace(user, workspace)
      workflows += workspace.workflows.length
      records += workspace.records.length
      conflicts += workspace.conflicts?.length || 0
    }
    return { workflows, records, conflicts, workspaces: workspaces.length }
  }

  const workflows = await getJson<WorkflowListItem[]>("/api/workflows")
  if (!workflows?.length) return { workflows: 0, records: 0, conflicts: 0, workspaces: 0 }

  const workflowDefinitions: WorkflowDefinition[] = []
  const records: RecordData[] = []

  for (const workflow of workflows) {
    const definition = await getJson<WorkflowDefinition>(`/api/workflows/${workflow.id}/definition`)
    workflowDefinitions.push(definition ?? workflow)

    const workflowRecords = await getJson<RecordData[]>(`/api/workflows/${workflow.id}/records`)
    if (Array.isArray(workflowRecords)) records.push(...workflowRecords)
  }

  const conflicts = await getJson<ConflictRecord[]>("/api/sync/conflict")
  await writeWorkspace(user, {
    orgId: user.orgId,
    workflows: workflowDefinitions,
    records,
    conflicts: Array.isArray(conflicts) ? conflicts : [],
  })

  return {
    workflows: workflowDefinitions.length,
    records: records.length,
    conflicts: Array.isArray(conflicts) ? conflicts.length : 0,
    workspaces: 1,
  }
}
