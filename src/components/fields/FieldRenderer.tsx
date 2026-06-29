"use client"

import type { WorkflowField } from "@/types/workflow"
import { formatFieldValue, fieldLabel, optionLabel } from "@/lib/workflows/runtime"
import { useTranslation } from "react-i18next"
import { useState } from "react"
import { Camera, Cloud, HardDrive, Loader2, TriangleAlert } from "lucide-react"
import { compressFieldImage } from "@/lib/media/image-compression"
import { db } from "@/lib/db/indexeddb"
import { isAttachmentValue, uploadLocalAttachment } from "@/lib/attachments/upload"
import type { AttachmentContext, AttachmentValue, LocalAttachment } from "@/types/attachment"

type Props = {
  field: WorkflowField
  value: unknown
  onChange?: (value: unknown) => void
  error?: string
  language?: string
  readOnly?: boolean
  attachmentContext?: Omit<AttachmentContext, "fieldKey">
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export function FieldRenderer({ field, value, onChange, error, language, readOnly, attachmentContext }: Props) {
  const { t } = useTranslation()
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoProgress, setPhotoProgress] = useState(0)
  const [photoError, setPhotoError] = useState("")
  const label = fieldLabel(field, language)
  const fieldType = field.type.replace("_", "-")
  const attachmentValue = isAttachmentValue(value) ? value : null

  async function handlePhoto(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setPhotoError(t("workflow.photoInvalid", "Choose an image file."))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setPhotoError(t("workflow.photoTooLarge", "Photos must be 10 MB or smaller."))
      return
    }

    setPhotoBusy(true)
    setPhotoProgress(0)
    setPhotoError("")
    try {
      const compressed = await compressFieldImage(file)
      const id = crypto.randomUUID()
      const now = Date.now()
      const local: LocalAttachment = {
        id,
        orgId: attachmentContext?.orgId,
        workflowId: attachmentContext?.workflowId,
        recordId: attachmentContext?.recordId,
        fieldKey: field.key,
        fileName: file.name,
        mimeType: compressed.mimeType,
        originalSize: file.size,
        compressedSize: compressed.compressedSize,
        width: compressed.width,
        height: compressed.height,
        thumbnailDataUrl: compressed.thumbnailDataUrl,
        blob: compressed.uploadBlob,
        status: "local",
        createdAt: now,
        updatedAt: now,
      }
      await db.putAttachment(local)
      const nextValue: AttachmentValue = {
        id,
        status: "local",
        fileName: file.name,
        mimeType: compressed.mimeType,
        originalSize: file.size,
        compressedSize: compressed.compressedSize,
        width: compressed.width,
        height: compressed.height,
        thumbnailDataUrl: compressed.thumbnailDataUrl,
      }
      onChange?.(nextValue)

      if (navigator.onLine) {
        try {
          const uploaded = await uploadLocalAttachment(local, { ...attachmentContext, fieldKey: field.key }, setPhotoProgress)
          onChange?.(uploaded)
        } catch {
          // Keep the local evidence. It can be retried by selecting a photo again once S3 is configured/online.
        }
      }
    } catch {
      setPhotoError(t("workflow.photoFailed", "Could not prepare this photo."))
    } finally {
      setPhotoBusy(false)
    }
  }
  if (readOnly && field.type === "photo") {
    return (
      <div className="grid gap-2 rounded-md border border-graph-line bg-white px-3 py-2 sm:grid-cols-[12rem_1fr] sm:items-start">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-pencil">{label}</span>
        {attachmentValue ? (
          <div className="min-w-0 space-y-2">
            {attachmentValue.thumbnailDataUrl && (
              <img src={attachmentValue.thumbnailDataUrl} alt="" className="h-32 w-full rounded-md border border-graph-line object-cover sm:max-w-64" />
            )}
            <span className="flex items-center gap-2 text-sm text-ink-black">
              {attachmentValue.status === "uploaded" ? <Cloud className="h-4 w-4 text-antiseptic-green" /> : <HardDrive className="h-4 w-4 text-warning-500" />}
              {attachmentValue.fileName}
            </span>
          </div>
        ) : (
          <span className="text-sm text-pencil">-</span>
        )}
      </div>
    )
  }

  if (readOnly) {
    return (
      <div className="grid gap-1 rounded-md border border-graph-line bg-white px-3 py-2 sm:grid-cols-[12rem_1fr] sm:items-baseline">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-pencil">{label}</span>
        <span className="min-w-0 text-sm text-ink-black">{formatFieldValue(value, field)}</span>
      </div>
    )
  }

  const common = {
    id: field.key,
    name: field.key,
    "aria-invalid": Boolean(error),
    className: "h-11 w-full rounded-md border border-graph-line bg-white px-3 py-2 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-blue",
  }

  return (
    <div className="min-w-0">
      <label htmlFor={field.key} className="mb-1 block text-sm font-medium text-pencil">
        {label}
        {field.required && <span className="ml-0.5 text-danger-500">*</span>}
      </label>

      {field.type === "textarea" ? (
        <textarea
          {...common}
          className={`${common.className} min-h-24 resize-y`}
          value={String(value ?? "")}
          onChange={(event) => onChange?.(event.target.value)}
        />
      ) : field.type === "select" ? (
        <select {...common} value={String(value ?? "")} onChange={(event) => onChange?.(event.target.value)}>
          <option value="">-</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>{optionLabel(field, option.value, language) || option.label}</option>
          ))}
        </select>
      ) : fieldType === "multi-select" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {(field.options ?? []).map((option) => {
            const selected = Array.isArray(value) && value.includes(option.value)
            return (
              <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-md border border-graph-line bg-white px-3 text-sm text-ink-black">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const current = Array.isArray(value) ? value.map(String) : []
                    onChange?.(selected ? current.filter((item) => item !== option.value) : [...current, option.value])
                  }}
                  className="h-4 w-4 accent-ink-blue"
                />
                <span>{optionLabel(field, option.value, language) || option.label}</span>
              </label>
            )
          })}
        </div>
      ) : field.type === "number" && field.validation?.min !== undefined && field.validation?.max !== undefined && field.validation.max <= 10 ? (
        <div className="flex items-center gap-3">
          <input
            type="range"
            id={field.key}
            min={field.validation.min}
            max={field.validation.max}
            value={Number(value ?? field.validation.min)}
            onChange={(event) => onChange?.(Number(event.target.value))}
            className="h-11 flex-1 accent-ink-blue"
          />
          <span className="min-w-12 rounded-md border border-graph-line bg-kivu-paper px-2 py-1 text-center text-sm font-mono text-ink-black">
            {String(value ?? field.validation.min)}
          </span>
        </div>
      ) : field.type === "photo" ? (
        <div className="rounded-md border border-graph-line bg-white p-3">
          {attachmentValue?.thumbnailDataUrl ? (
            <div className="mb-3 overflow-hidden rounded-md border border-graph-line bg-graph-paper">
              <img src={attachmentValue.thumbnailDataUrl} alt="" className="h-40 w-full object-cover" />
            </div>
          ) : null}
          <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-graph-line bg-graph-paper px-3 text-sm font-medium text-ink-black transition-colors hover:bg-white">
            {photoBusy ? <Loader2 className="h-4 w-4 animate-spin text-ink-blue" /> : <Camera className="h-4 w-4 text-ink-blue" />}
            <span>{photoBusy ? t("workflow.photoPreparing", "Preparing photo...") : t("workflow.photoChoose", "Add photo")}</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={photoBusy}
              onChange={(event) => void handlePhoto(event.target.files?.[0])}
            />
          </label>
          {photoBusy && photoProgress > 0 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-graph-paper">
              <div className="h-full rounded-full bg-ink-blue transition-all" style={{ width: `${photoProgress}%` }} />
            </div>
          )}
          {attachmentValue && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-pencil">
              {attachmentValue.status === "uploaded" ? <Cloud className="h-3.5 w-3.5 text-antiseptic-green" /> : <HardDrive className="h-3.5 w-3.5 text-warning-500" />}
              {attachmentValue.status === "uploaded" ? t("workflow.photoUploaded", "Uploaded") : t("workflow.photoStoredLocal", "Saved on this device")}
              {" · "}
              {Math.round(attachmentValue.compressedSize / 1024)} KB
            </p>
          )}
          {photoError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-danger-500">
              <TriangleAlert className="h-3.5 w-3.5" />
              {photoError}
            </p>
          )}
        </div>
      ) : field.type === "gps" ? (
        <input
          {...common}
          value={t("workflow.unsupportedField", "Temporarily unavailable")}
          disabled
          className={`${common.className} bg-graph-paper text-pencil`}
        />
      ) : (
        <input
          {...common}
          type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
          min={field.validation?.min}
          max={field.validation?.max}
          value={String(value ?? "")}
          onChange={(event) => onChange?.(field.type === "number" ? Number(event.target.value) : event.target.value)}
        />
      )}

      {error && <p className="mt-1 text-sm text-danger-500">{error}</p>}
    </div>
  )
}
