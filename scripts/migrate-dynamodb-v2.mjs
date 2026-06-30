import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb"

const region = process.env.AWS_REGION || "us-east-1"
const sourceTable = process.env.SOURCE_DYNAMODB_TABLE || "FieldFlowRecords"
const targetTable = process.env.TARGET_DYNAMODB_TABLE || "FieldFlowRecordsV2"
const batchSize = 25
const nowSeconds = Math.floor(Date.now() / 1000)

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }))

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function entityIdFor(item) {
  if (typeof item.entityId === "string") return item.entityId
  if (typeof item.userId === "string") return item.userId
  if (typeof item.device_id === "string") return item.device_id
  if (typeof item.deviceId === "string") return item.deviceId
  if (typeof item.client_id === "string") return item.client_id
  if (typeof item.eventId === "string") return item.eventId
  if (typeof item.id === "string") return item.id
  return ""
}

function indexSk(entityType, item, entityId) {
  if (entityType === "mutation") return `SEQ#${String(Number(item.server_seq || 0)).padStart(12, "0")}#${entityId || item.client_id || ""}`
  if (entityType === "conflict") return `${String(item.status || "OPEN")}#${String(Number(item.created_at || Date.now())).padStart(13, "0")}#${entityId || ""}`
  if (entityType === "audit") return `RECORD#${String(item.recordId || item.record_id || "")}#${String(Number(item.timestamp || Date.now())).padStart(13, "0")}#${entityId || ""}`
  if (entityType === "inventory_ledger") return `TS#${String(Number(item.timestamp || Date.now())).padStart(13, "0")}#${entityId || ""}`
  return `${entityId || item.id || item.device_id || item.client_id || ""}`
}

function accessPaths(entityType, item, entityId) {
  const orgId = typeof item.orgId === "string" ? item.orgId : typeof item.org_id === "string" ? item.org_id : ""
  const email = typeof item.email === "string" ? item.email.toLowerCase() : ""
  return {
    ...(orgId ? { gsi1pk: `ORG#${orgId}#${entityType}`, gsi1sk: indexSk(entityType, item, entityId) } : {}),
    ...(entityType === "user" && email ? { gsi2pk: `EMAIL#${email}`, gsi2sk: `ORG#${orgId}#USER#${entityId || email}` } : {}),
  }
}

function fallbackPk(item) {
  if (typeof item.pk === "string") return item.pk
  if (typeof item.id === "string") return item.id
  const entityType = String(item.entityType || "item")
  const orgId = typeof item.orgId === "string" ? item.orgId : typeof item.org_id === "string" ? item.org_id : "global"
  return `ORG#${orgId}#${entityType.toUpperCase()}#${entityIdFor(item)}`
}

function fallbackSk(item) {
  if (typeof item.sk === "string") return item.sk
  if (item.entityType === "workflow") return "DEFINITION"
  if (item.entityType === "device") return "STATE"
  return "PROFILE"
}

function shouldSkipExpired(item) {
  return typeof item.expiresAt === "number" && item.expiresAt <= nowSeconds
}

function normalizeItem(item) {
  if (shouldSkipExpired(item)) return null
  const entityType = String(item.entityType || "item")
  const entityId = entityIdFor(item)
  const pk = fallbackPk(item)
  const sk = fallbackSk(item)
  return {
    ...item,
    id: typeof item.id === "string" ? item.id : pk,
    pk,
    sk,
    entityType,
    ...(entityId ? { entityId } : {}),
    ...accessPaths(entityType, item, entityId),
  }
}

async function writeBatch(items) {
  let requestItems = {
    [targetTable]: items.map((Item) => ({ PutRequest: { Item } })),
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await client.send(new BatchWriteCommand({ RequestItems: requestItems }))
    const unprocessed = result.UnprocessedItems?.[targetTable] || []
    if (unprocessed.length === 0) return
    requestItems = { [targetTable]: unprocessed }
    await sleep(2 ** attempt * 100)
  }

  throw new Error(`DynamoDB still returned unprocessed writes for ${requestItems[targetTable].length} items`)
}

async function countTable(tableName) {
  let count = 0
  let ExclusiveStartKey
  do {
    const result = await client.send(new ScanCommand({
      TableName: tableName,
      Select: "COUNT",
      ExclusiveStartKey,
    }))
    count += result.Count || 0
    ExclusiveStartKey = result.LastEvaluatedKey
  } while (ExclusiveStartKey)
  return count
}

async function migrate() {
  console.log(`Migrating ${sourceTable} -> ${targetTable} in ${region}`)
  let scanned = 0
  let skippedExpired = 0
  let written = 0
  let batch = []
  let ExclusiveStartKey

  do {
    const result = await client.send(new ScanCommand({
      TableName: sourceTable,
      ExclusiveStartKey,
    }))
    for (const rawItem of result.Items || []) {
      scanned += 1
      const item = normalizeItem(rawItem)
      if (!item) {
        skippedExpired += 1
        continue
      }
      batch.push(item)
      if (batch.length === batchSize) {
        await writeBatch(batch)
        written += batch.length
        batch = []
      }
    }
    ExclusiveStartKey = result.LastEvaluatedKey
    console.log(`Scanned ${scanned}; written ${written}; skipped expired ${skippedExpired}`)
  } while (ExclusiveStartKey)

  if (batch.length) {
    await writeBatch(batch)
    written += batch.length
  }

  const targetCount = await countTable(targetTable)
  console.log(JSON.stringify({ scanned, written, skippedExpired, targetCount }, null, 2))
}

migrate().catch((error) => {
  console.error(error)
  process.exit(1)
})
