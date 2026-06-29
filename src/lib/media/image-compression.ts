"use client"

const UPLOAD_TARGET_BYTES = 950_000
const THUMB_TARGET_BYTES = 90_000

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("image_load_failed"))
    }
    image.src = url
  })
}

function scale(width: number, height: number, maxDim: number) {
  if (width <= maxDim && height <= maxDim) return { width, height }
  const ratio = Math.min(maxDim / width, maxDim / height)
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("image_encode_failed"))
      else resolve(blob)
    }, "image/webp", quality)
  })
}

async function encodeToTarget(image: HTMLImageElement, maxDim: number, targetBytes: number) {
  const size = scale(image.naturalWidth || image.width, image.naturalHeight || image.height, maxDim)
  const canvas = document.createElement("canvas")
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas_unavailable")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(image, 0, 0, size.width, size.height)

  let best = await canvasToBlob(canvas, 0.82)
  let low = 0.45
  let high = 0.9
  for (let i = 0; i < 7; i++) {
    const quality = (low + high) / 2
    const blob = await canvasToBlob(canvas, quality)
    if (blob.size > targetBytes) {
      high = quality
    } else {
      best = blob
      low = quality
    }
  }
  return { blob: best, width: size.width, height: size.height }
}

export async function compressFieldImage(file: File) {
  const image = await loadImage(file)
  const upload = await encodeToTarget(image, 1600, UPLOAD_TARGET_BYTES)
  const thumbnail = await encodeToTarget(image, 420, THUMB_TARGET_BYTES)
  const thumbnailDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("thumbnail_read_failed"))
    reader.readAsDataURL(thumbnail.blob)
  })

  return {
    uploadBlob: upload.blob,
    thumbnailDataUrl,
    width: upload.width,
    height: upload.height,
    mimeType: "image/webp",
    compressedSize: upload.blob.size,
  }
}

export function uploadToPresignedUrl(url: string, blob: Blob, mimeType: string, onProgress?: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open("PUT", url)
    request.setRequestHeader("Content-Type", mimeType)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve()
      else reject(new Error(`upload_failed_${request.status}`))
    }
    request.onerror = () => reject(new Error("network_error"))
    request.send(blob)
  })
}
