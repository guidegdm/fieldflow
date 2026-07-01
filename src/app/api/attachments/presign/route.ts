import { NextRequest, NextResponse } from "next/server"
import { createHash, createHmac } from "node:crypto"
import { z } from "zod"
import { getAuthUser } from "@/lib/auth/middleware"
import { getStore } from "@/lib/api/in-memory-store"

const requestSchema = z.object({
  attachmentId: z.string().min(8),
  workflowId: z.string().min(1),
  recordId: z.string().min(1),
  fieldKey: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive().max(1_100_000),
})

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest()
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function signingKey(secret: string, date: string, region: string) {
  const kDate = hmac(`AWS4${secret}`, date)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, "s3")
  return hmac(kService, "aws4_request")
}

function encodeKey(key: string) {
  return key.split("/").map((part) => encodeURIComponent(part)).join("/")
}

function safePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item"
}

function amzDateParts(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "")
  return { amzDate: iso, shortDate: iso.slice(0, 8) }
}

function createPresignedPutUrl(params: {
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  key: string
  expiresSeconds: number
}) {
  const { bucket, region, accessKeyId, secretAccessKey, key, expiresSeconds } = params
  const { amzDate, shortDate } = amzDateParts()
  const host = `${bucket}.s3.${region}.amazonaws.com`
  const credentialScope = `${shortDate}/${region}/s3/aws4_request`
  const credential = `${accessKeyId}/${credentialScope}`
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host",
  })
  const canonicalQuery = Array.from(query.entries())
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .sort()
    .join("&")
  const canonicalRequest = [
    "PUT",
    `/${encodeKey(key)}`,
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n")
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hash(canonicalRequest),
  ].join("\n")
  const signature = createHmac("sha256", signingKey(secretAccessKey, shortDate, region)).update(stringToSign).digest("hex")
  return `https://${host}/${encodeKey(key)}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid attachment request" }, { status: 400 })

  const body = parsed.data
  const store = getStore()
  const [workflow, record] = await Promise.all([
    store.getWorkflowForOrgAsync(body.workflowId, user.orgId),
    store.getRecordForOrg(body.recordId, user.orgId),
  ])
  if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 })
  if (!record || record.workflowId !== workflow.id || record.orgId !== user.orgId) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 })
  }
  const field = workflow.entity.fields.find((candidate) => candidate.key === body.fieldKey)
  if (!field || field.type !== "photo") {
    return NextResponse.json({ error: "Attachment field not found" }, { status: 400 })
  }

  const bucket = process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || process.env.FIELD_FLOW_ATTACHMENTS_BUCKET
  const region = process.env.S3_REGION || process.env.AWS_REGION || "us-east-1"
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  if (!bucket || !accessKeyId || !secretAccessKey) {
    return NextResponse.json({ error: "S3 attachments are not configured" }, { status: 503 })
  }

  const key = [
    "orgs",
    safePart(user.orgId),
    "workflows",
    safePart(body.workflowId),
    "records",
    safePart(body.recordId),
    "fields",
    safePart(body.fieldKey),
    `${safePart(body.attachmentId)}.webp`,
  ].join("/")

  const uploadUrl = createPresignedPutUrl({
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    key,
    expiresSeconds: 10 * 60,
  })

  return NextResponse.json({
    attachmentId: body.attachmentId,
    key,
    uploadUrl,
    expiresIn: 600,
  })
}
