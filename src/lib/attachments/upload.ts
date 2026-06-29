"use client"

import { db } from "@/lib/db/indexeddb"
import { uploadToPresignedUrl } from "@/lib/media/image-compression"
import type { AttachmentContext, AttachmentValue, LocalAttachment } from "@/types/attachment"

export async function uploadLocalAttachment(
  attachment: LocalAttachment,
  context: AttachmentContext,
  onProgress?: (progress: number) => void,
): Promise<AttachmentValue> {
  await db.updateAttachment(attachment.id, { status: "uploading", error: undefined })
  const response = await fetch("/api/attachments/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      attachmentId: attachment.id,
      workflowId: context.workflowId || attachment.workflowId || "workflow",
      recordId: context.recordId || attachment.recordId || "pending-record",
      fieldKey: context.fieldKey || attachment.fieldKey,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.compressedSize,
    }),
  })
  if (!response.ok) {
    const reason = response.status === 503 ? "s3_not_configured" : `presign_failed_${response.status}`
    await db.updateAttachment(attachment.id, { status: "failed", error: reason })
    throw new Error(reason)
  }
  const data = await response.json() as { key: string; uploadUrl: string }
  await uploadToPresignedUrl(data.uploadUrl, attachment.blob, attachment.mimeType, onProgress)
  const uploadedAt = Date.now()
  await db.updateAttachment(attachment.id, {
    status: "uploaded",
    s3Key: data.key,
    error: undefined,
    updatedAt: uploadedAt,
  })
  return {
    id: attachment.id,
    status: "uploaded",
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    originalSize: attachment.originalSize,
    compressedSize: attachment.compressedSize,
    thumbnailDataUrl: attachment.thumbnailDataUrl,
    width: attachment.width,
    height: attachment.height,
    s3Key: data.key,
    uploadedAt,
  }
}

export function isAttachmentValue(value: unknown): value is AttachmentValue {
  return Boolean(value && typeof value === "object" && "id" in value && "status" in value && "compressedSize" in value)
}
