export type AttachmentStatus = "local" | "uploading" | "uploaded" | "failed"

export interface AttachmentValue {
  id: string
  status: AttachmentStatus
  fileName: string
  mimeType: string
  originalSize: number
  compressedSize: number
  thumbnailDataUrl?: string
  width?: number
  height?: number
  s3Key?: string
  uploadedAt?: number
  error?: string
}

export interface LocalAttachment {
  id: string
  orgId?: string
  workflowId?: string
  recordId?: string
  fieldKey: string
  fileName: string
  mimeType: string
  originalSize: number
  compressedSize: number
  width?: number
  height?: number
  thumbnailDataUrl?: string
  blob: Blob
  status: AttachmentStatus
  s3Key?: string
  error?: string
  createdAt: number
  updatedAt: number
}

export interface AttachmentContext {
  orgId?: string
  workflowId?: string
  recordId?: string
  fieldKey: string
}
