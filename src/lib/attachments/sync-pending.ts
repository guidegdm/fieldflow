"use client"

import { db } from "@/lib/db/indexeddb"
import { isAttachmentValue, uploadLocalAttachment } from "@/lib/attachments/upload"
import type { DemoUser } from "@/types/auth"
import type { AttachmentValue } from "@/types/attachment"

function replaceAttachmentValue(fields: Record<string, unknown>, uploaded: AttachmentValue) {
  let changed = false
  const next = { ...fields }
  for (const [key, value] of Object.entries(next)) {
    if (isAttachmentValue(value) && value.id === uploaded.id) {
      next[key] = uploaded
      changed = true
    }
  }
  return changed ? next : null
}

function replaceMutationPayload(payload: unknown, uploaded: AttachmentValue) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null
  const object = payload as Record<string, unknown>
  const fields = object.fields && typeof object.fields === "object" && !Array.isArray(object.fields)
    ? object.fields as Record<string, unknown>
    : object
  const nextFields = replaceAttachmentValue(fields, uploaded)
  if (!nextFields) return null
  return object.fields
    ? { ...object, fields: nextFields }
    : nextFields
}

export async function syncPendingAttachments(user?: DemoUser | null) {
  if (!user?.orgId || typeof navigator !== "undefined" && !navigator.onLine) return
  const pending = (await db.getPendingAttachments()).filter((attachment) => !attachment.orgId || attachment.orgId === user.orgId)
  if (pending.length === 0) return

  const records = await db.getAllRecordsForOrg(user.orgId)
  const mutations = await db.getPendingMutations()

  for (const attachment of pending) {
    try {
      const uploaded = await uploadLocalAttachment(attachment, {
        orgId: user.orgId,
        workflowId: attachment.workflowId,
        recordId: attachment.recordId,
        fieldKey: attachment.fieldKey,
      })

      for (const record of records) {
        const fields = replaceAttachmentValue(record.fields ?? {}, uploaded)
        if (fields) await db.putRecord({ ...record, fields, updatedAt: Date.now() })
      }

      for (const mutation of mutations) {
        const payload = replaceMutationPayload(mutation.payload, uploaded)
        if (payload) await db.putMutation({ ...mutation, payload })
      }
    } catch {
      // Leave the attachment queued locally; the next online sync can retry it.
    }
  }
}
