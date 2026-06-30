import { createHash } from "node:crypto"
import { DescribeTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  ScanCommand,
  type ScanCommandInput,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb"
import type { RecordData } from "@/types/record"
import type { ConflictRecord, DeviceState, InventoryLedgerEntry, MutationEntry } from "@/types/sync"
import type { WorkflowDefinition } from "@/types/workflow"

export interface InventoryItem {
  id: string
  name: string
  total: number
  reserved: number
  orgId: string
  expiresAt?: number
}

const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
})
const client = DynamoDBDocumentClient.from(rawClient)

const TABLE = process.env.DYNAMODB_TABLE || "FieldFlowRecords"
interface TableKeyShape {
  hashName: string
  rangeName?: string
}

let tableKeyShapePromise: Promise<TableKeyShape> | null = null
let tableKeyShapeOverride: TableKeyShape | null = null

async function tableKeyShape(): Promise<TableKeyShape> {
  const envHash = process.env.DYNAMODB_HASH_KEY
  const envRange = process.env.DYNAMODB_RANGE_KEY
  if (envHash) return envRange ? { hashName: envHash, rangeName: envRange } : { hashName: envHash }
  if (process.env.DYNAMODB_SORT_KEY_ENABLED === "true") return { hashName: "pk", rangeName: "sk" }
  if (process.env.DYNAMODB_SORT_KEY_ENABLED === "false") return { hashName: "pk" }
  if (tableKeyShapeOverride) return tableKeyShapeOverride

  tableKeyShapePromise ||= rawClient.send(new DescribeTableCommand({ TableName: TABLE }))
    .then((result) => {
      const keys = result.Table?.KeySchema || []
      const hashName = keys.find((key) => key.KeyType === "HASH")?.AttributeName || "id"
      const rangeName = keys.find((key) => key.KeyType === "RANGE")?.AttributeName
      return rangeName ? { hashName, rangeName } : { hashName }
    })
    .catch(() => ({ hashName: "id" }))
  return tableKeyShapePromise
}

function keyFor(pk: string, sk: string, shape: TableKeyShape) {
  return shape.rangeName ? { [shape.hashName]: pk, [shape.rangeName]: sk } : { [shape.hashName]: pk }
}

async function tableKey(pk: string, sk: string) {
  return keyFor(pk, sk, await tableKeyShape())
}

function itemForKey(pk: string, sk: string, entityType: string, attrs: Record<string, unknown>, entityId?: string) {
  const originalId = entityId || (typeof attrs.id === "string" ? attrs.id : undefined)
  return {
    ...attrs,
    id: pk,
    pk,
    sk,
    entityType,
    ...(originalId ? { entityId: originalId } : {}),
  }
}

function isKeySchemaError(error: unknown) {
  return error instanceof Error && error.name === "ValidationException" && error.message.includes("key element")
}

async function sendGet(pk: string, sk: string, projectionExpression?: string) {
  const firstShape = await tableKeyShape()
  try {
    return await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: keyFor(pk, sk, firstShape),
        ProjectionExpression: projectionExpression,
      })
    )
  } catch (error) {
    if (!isKeySchemaError(error) || process.env.DYNAMODB_SORT_KEY_ENABLED) throw error
    const fallbackShapes = [
      { hashName: "id" },
      { hashName: "pk" },
      { hashName: "pk", rangeName: "sk" },
    ].filter((shape) => shape.hashName !== firstShape.hashName || shape.rangeName !== firstShape.rangeName)

    for (const shape of fallbackShapes) {
      tableKeyShapeOverride = shape
      tableKeyShapePromise = Promise.resolve(shape)
      try {
        return await client.send(
          new GetCommand({
            TableName: TABLE,
            Key: keyFor(pk, sk, shape),
            ProjectionExpression: projectionExpression,
          })
        )
      } catch (retryError) {
        if (!isKeySchemaError(retryError)) throw retryError
      }
    }

    try {
      const items = await scanAll({
        FilterExpression: "pk = :pk AND sk = :sk",
        ExpressionAttributeValues: { ":pk": pk, ":sk": sk },
        ProjectionExpression: projectionExpression,
        Limit: 1,
      })
      return { Item: items[0] }
    } catch (scanError) {
      throw scanError
    }
  }
}

async function sendDelete(pk: string, sk: string) {
  const firstShape = await tableKeyShape()
  try {
    return await client.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: keyFor(pk, sk, firstShape),
      })
    )
  } catch (error) {
    if (!isKeySchemaError(error) || process.env.DYNAMODB_SORT_KEY_ENABLED) throw error
    const fallbackShape = firstShape.hashName === "id" ? { hashName: "pk" } : { hashName: "id" }
    tableKeyShapeOverride = fallbackShape
    tableKeyShapePromise = Promise.resolve(fallbackShape)
    return client.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: keyFor(pk, sk, fallbackShape),
      })
    )
  }
}

async function scanAll(input: Omit<ScanCommandInput, "TableName">) {
  const items: Record<string, unknown>[] = []
  let ExclusiveStartKey = input.ExclusiveStartKey
  do {
    const result = await client.send(
      new ScanCommand({
        ...input,
        TableName: TABLE,
        ExclusiveStartKey,
      })
    )
    items.push(...((result.Items || []) as Record<string, unknown>[]))
    ExclusiveStartKey = result.LastEvaluatedKey
  } while (ExclusiveStartKey && (!input.Limit || items.length < input.Limit))

  return input.Limit ? items.slice(0, input.Limit) : items
}

function stripKeys<T>(item: (T & Record<string, unknown>) | undefined): T | undefined {
  if (!item) return undefined
  const { pk: _pk, sk: _sk, entityType: _entityType, entityId, id: _tableId, ...rest } = item
  if (typeof entityId === "string") return { ...rest, id: entityId } as unknown as T
  return rest as unknown as T
}

function orgRecordPk(orgId: string, id: string) {
  return `ORG#${orgId}#RECORD#${id}`
}

function orgWorkflowPk(orgId: string, id: string) {
  return `ORG#${orgId}#WORKFLOW#${id}`
}

function orgDevicePk(orgId: string, id: string) {
  return `ORG#${orgId}#DEVICE#${id}`
}

function orgConflictPk(orgId: string, id: string) {
  return `ORG#${orgId}#CONFLICT#${id}`
}

function orgInventoryPk(orgId: string, id: string) {
  return `ORG#${orgId}#INVENTORY#${id}`
}

function orgInventoryReceiptPk(orgId: string, idempotencyKey: string) {
  return `ORG#${orgId}#INVENTORY_RECEIPT#${idempotencyKey}`
}

function orgInventoryLedgerPk(orgId: string, id: string) {
  return `ORG#${orgId}#INVENTORY_LEDGER#${id}`
}

function orgMutationPk(orgId: string, id: string) {
  return `ORG#${orgId}#MUTATION#${id}`
}

function orgAuditPk(orgId: string, recordId: string) {
  return `ORG#${orgId}#AUDIT#${recordId}`
}

function demoSandboxMetricPk(installId: string, orgId: string, timestamp: number) {
  return `DEMO#${installId}#SANDBOX#${orgId}#${timestamp}`
}

export const dynamoStore = {
  async putRecord(record: RecordData) {
    const orgId = record.orgId
    if (!orgId) throw new Error("record.orgId is required")
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: itemForKey(orgRecordPk(orgId, record.id), "PROFILE", "record", record as unknown as Record<string, unknown>, record.id),
      })
    )
  },

  async getRecord(id: string, orgId: string): Promise<RecordData | undefined> {
    const result = await sendGet(orgRecordPk(orgId, id), "PROFILE")
    return stripKeys<RecordData>(result.Item as (RecordData & Record<string, unknown>) | undefined)
  },

  async deleteRecord(id: string, orgId: string) {
    await sendDelete(orgRecordPk(orgId, id), "PROFILE")
  },

  async getRecordsByWorkflow(workflowId: string, orgId: string): Promise<RecordData[]> {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND orgId = :orgId AND workflowId = :workflowId",
      ExpressionAttributeValues: { ":type": "record", ":orgId": orgId, ":workflowId": workflowId },
    })
    return items.map((item) => stripKeys<RecordData>(item as RecordData & Record<string, unknown>)!)
  },

  async listRecords(orgId: string): Promise<RecordData[]> {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND orgId = :orgId",
      ExpressionAttributeValues: { ":type": "record", ":orgId": orgId },
    })
    return items.map((item) => stripKeys<RecordData>(item as RecordData & Record<string, unknown>)!)
  },

  async putWorkflow(workflow: WorkflowDefinition) {
    const orgId = workflow.orgId
    if (!orgId) throw new Error("workflow.orgId is required")
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: itemForKey(orgWorkflowPk(orgId, workflow.id), "DEFINITION", "workflow", workflow as unknown as Record<string, unknown>, workflow.id),
      })
    )
  },

  async getWorkflow(id: string, orgId: string): Promise<WorkflowDefinition | undefined> {
    const result = await sendGet(orgWorkflowPk(orgId, id), "DEFINITION")
    return stripKeys<WorkflowDefinition>(result.Item as (WorkflowDefinition & Record<string, unknown>) | undefined)
  },

  async listWorkflows(orgId: string): Promise<WorkflowDefinition[]> {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND orgId = :orgId",
      ExpressionAttributeValues: { ":type": "workflow", ":orgId": orgId },
    })
    return items.map((item) => stripKeys<WorkflowDefinition>(item as WorkflowDefinition & Record<string, unknown>)!)
  },

  async putDevice(device: DeviceState) {
    if (!device.orgId) throw new Error("device.orgId is required")
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: itemForKey(orgDevicePk(device.orgId, device.device_id), "STATE", "device", device as unknown as Record<string, unknown>, device.device_id),
      })
    )
  },

  async getDevice(deviceId: string, orgId: string): Promise<DeviceState | undefined> {
    const result = await sendGet(orgDevicePk(orgId, deviceId), "STATE")
    return stripKeys<DeviceState>(result.Item as (DeviceState & Record<string, unknown>) | undefined)
  },

  async listDevices(orgId: string): Promise<DeviceState[]> {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND orgId = :orgId",
      ExpressionAttributeValues: { ":type": "device", ":orgId": orgId },
    })
    return items.map((item) => stripKeys<DeviceState>(item as DeviceState & Record<string, unknown>)!)
  },

  async putConflict(conflict: ConflictRecord, orgId: string) {
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: itemForKey(orgConflictPk(orgId, conflict.id), "PROFILE", "conflict", { orgId, ...conflict } as unknown as Record<string, unknown>, conflict.id),
      })
    )
  },

  async getConflict(id: string, orgId: string): Promise<ConflictRecord | undefined> {
    const result = await sendGet(orgConflictPk(orgId, id), "PROFILE")
    return stripKeys<ConflictRecord>(result.Item as (ConflictRecord & Record<string, unknown>) | undefined)
  },

  async listOpenConflicts(orgId: string): Promise<ConflictRecord[]> {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND orgId = :orgId AND #status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":type": "conflict", ":orgId": orgId, ":status": "OPEN" },
    })
    return items.map((item) => stripKeys<ConflictRecord>(item as ConflictRecord & Record<string, unknown>)!)
  },

  async putInventoryItem(item: InventoryItem) {
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: itemForKey(orgInventoryPk(item.orgId, item.id), "PROFILE", "inventory", item as unknown as Record<string, unknown>, item.id),
      })
    )
  },

  async getInventoryItem(id: string, orgId: string): Promise<InventoryItem | undefined> {
    const result = await sendGet(orgInventoryPk(orgId, id), "PROFILE")
    return stripKeys<InventoryItem>(result.Item as (InventoryItem & Record<string, unknown>) | undefined)
  },

  async listInventoryItems(orgId: string): Promise<InventoryItem[]> {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND orgId = :orgId",
      ExpressionAttributeValues: { ":type": "inventory", ":orgId": orgId },
    })
    return items.map((item) => stripKeys<InventoryItem>(item as InventoryItem & Record<string, unknown>)!)
  },

  async reserveInventory(
    itemId: string,
    idempotencyKey: string,
    qty: number,
    userId: string,
    orgId: string,
  ): Promise<{ success: boolean; error?: string; remaining?: number; contentHash?: string; competingRequestId?: string; currentStock?: number; retryRecommended?: boolean }> {
    const contentHash = createHash("sha256").update(`${orgId}|${itemId}|${qty}|${userId}|${idempotencyKey}`).digest("hex")
    const existingReceipt = await sendGet(orgInventoryReceiptPk(orgId, idempotencyKey), "PROFILE")
    if (existingReceipt.Item) {
      return {
        success: Boolean(existingReceipt.Item.success),
        error: existingReceipt.Item.error as string | undefined,
        remaining: Number(existingReceipt.Item.remaining ?? 0),
        contentHash: String(existingReceipt.Item.contentHash || contentHash),
        retryRecommended: false,
      }
    }

    const item = await this.getInventoryItem(itemId, orgId)
    if (!item) return { success: false, error: "ITEM_NOT_FOUND", contentHash, retryRecommended: false }

    const available = item.total - item.reserved
    const timestamp = Date.now()
    if (available < qty) {
      const failureId = `ledger-${timestamp}-${contentHash.slice(0, 10)}`
      const receipt = {
        orgId,
        itemId,
        quantity: qty,
        userId,
        idempotencyKey,
        contentHash,
        success: false,
        error: "SERIALIZATION_FAILURE",
        remaining: available,
        timestamp,
        expiresAt: item.expiresAt,
      }
      const ledger: InventoryLedgerEntry & Record<string, unknown> = {
        id: failureId,
        contentHash,
        itemId,
        quantity: qty,
        userId,
        stockBefore: { total: item.total, reserved: item.reserved },
        stockAfter: { total: item.total, reserved: item.reserved },
        status: "failed_serialization",
        competingRequestId: `stock-${itemId}-${timestamp}`,
        idempotencyKey,
        timestamp,
        orgId,
        expiresAt: item.expiresAt,
      }
      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE,
                Item: itemForKey(orgInventoryReceiptPk(orgId, idempotencyKey), "PROFILE", "inventory_receipt", receipt),
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: TABLE,
                Item: itemForKey(orgInventoryLedgerPk(orgId, failureId), "PROFILE", "inventory_ledger", ledger, ledger.id),
              },
            },
          ],
        })
      ).catch(async (error) => {
        if (error instanceof Error && error.name !== "TransactionCanceledException") throw error
      })
      return {
        success: false,
        error: "SERIALIZATION_FAILURE",
        contentHash,
        currentStock: available,
        competingRequestId: ledger.competingRequestId,
        retryRecommended: true,
      }
    }

    const remaining = available - qty
    const committedId = `ledger-${timestamp}-${contentHash.slice(0, 10)}`
    const ledger: InventoryLedgerEntry & Record<string, unknown> = {
      id: committedId,
      contentHash,
      itemId,
      quantity: qty,
      userId,
      stockBefore: { total: item.total, reserved: item.reserved },
      stockAfter: { total: item.total, reserved: item.reserved + qty },
      status: "committed",
      idempotencyKey,
      timestamp,
      orgId,
      expiresAt: item.expiresAt,
    }
    const receipt = {
      orgId,
      itemId,
      quantity: qty,
      userId,
      idempotencyKey,
      contentHash,
      success: true,
      remaining,
      timestamp,
      expiresAt: item.expiresAt,
    }

    try {
      await client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: TABLE,
                Item: itemForKey(orgInventoryReceiptPk(orgId, idempotencyKey), "PROFILE", "inventory_receipt", receipt),
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Update: {
                TableName: TABLE,
                Key: await tableKey(orgInventoryPk(orgId, itemId), "PROFILE"),
                UpdateExpression: "SET reserved = reserved + :qty",
                ConditionExpression: "orgId = :orgId AND reserved <= :reservedLimit",
                ExpressionAttributeValues: {
                  ":qty": qty,
                  ":orgId": orgId,
                  ":reservedLimit": item.total - qty,
                },
              },
            },
            {
              Put: {
                TableName: TABLE,
                Item: itemForKey(orgInventoryLedgerPk(orgId, committedId), "PROFILE", "inventory_ledger", ledger, ledger.id),
              },
            },
          ],
        })
      )
      return { success: true, contentHash, remaining }
    } catch (error) {
      const receiptAfterFailure = await sendGet(orgInventoryReceiptPk(orgId, idempotencyKey), "PROFILE")
      if (receiptAfterFailure.Item) {
        return {
          success: Boolean(receiptAfterFailure.Item.success),
          error: receiptAfterFailure.Item.error as string | undefined,
          remaining: Number(receiptAfterFailure.Item.remaining ?? 0),
          contentHash: String(receiptAfterFailure.Item.contentHash || contentHash),
          retryRecommended: false,
        }
      }

      const latest = await this.getInventoryItem(itemId, orgId)
      const currentStock = latest ? latest.total - latest.reserved : 0
      return {
        success: false,
        error: "SERIALIZATION_FAILURE",
        contentHash,
        currentStock,
        competingRequestId: `stock-${itemId}-${Date.now()}`,
        retryRecommended: true,
      }
    }
  },

  async listInventoryLedger(orgId: string): Promise<InventoryLedgerEntry[]> {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND orgId = :orgId",
      ExpressionAttributeValues: { ":type": "inventory_ledger", ":orgId": orgId },
    })
    return items.map((item) => stripKeys<InventoryLedgerEntry>(item as InventoryLedgerEntry & Record<string, unknown>)!)
  },

  async putMutation(mutation: MutationEntry, orgId: string, serverSeq: number) {
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: itemForKey(orgMutationPk(orgId, mutation.client_id), "PROFILE", "mutation", { orgId, ...mutation, server_seq: serverSeq } as unknown as Record<string, unknown>, mutation.client_id),
      })
    )
  },

  async hasMutation(clientId: string, orgId: string): Promise<boolean> {
    const result = await sendGet(orgMutationPk(orgId, clientId), "PROFILE", "pk")
    return !!result.Item
  },

  async getServerSince(orgId: string, seq: number): Promise<MutationEntry[]> {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND orgId = :orgId AND server_seq > :seq",
      ExpressionAttributeValues: { ":type": "mutation", ":orgId": orgId, ":seq": seq },
    })
    return items.map((item) => stripKeys<MutationEntry>(item as MutationEntry & Record<string, unknown>)!)
  },

  async getCurrentSeq(orgId: string): Promise<number> {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND orgId = :orgId",
      ExpressionAttributeValues: { ":type": "mutation", ":orgId": orgId },
      ProjectionExpression: "server_seq",
    })
    return Math.max(0, ...items.map((item) => Number(item.server_seq || 0)))
  },

  async putOrgItem(item: Record<string, unknown>) {
    const id = String(item.id || item.orgId || "")
    if (!id) throw new Error("org id is required")
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: itemForKey(`ORG#${id}`, "PROFILE", "org", item, id),
      })
    )
  },

  async getOrgItem(id: string) {
    const result = await sendGet(`ORG#${id}`, "PROFILE")
    return stripKeys(result.Item)
  },

  async putUserProfile(item: Record<string, unknown>) {
    const orgId = String(item.orgId || "")
    const userId = String(item.userId || item.email || "")
    if (!orgId || !userId) throw new Error("user profile orgId and userId are required")
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: itemForKey(`ORG#${orgId}#USER#${userId}`, "PROFILE", "user", item, userId),
      })
    )
  },

  async listUserProfiles(orgId: string) {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND orgId = :orgId",
      ExpressionAttributeValues: { ":type": "user", ":orgId": orgId },
    })
    return items.map((item) => stripKeys(item))
  },

  async getUserProfileByEmail(email: string) {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND email = :email",
      ExpressionAttributeValues: { ":type": "user", ":email": email },
      Limit: 1,
    })
    return stripKeys(items[0])
  },

  async listUserProfilesByEmail(email: string) {
    const items = await scanAll({
      FilterExpression: "entityType = :type AND email = :email",
      ExpressionAttributeValues: { ":type": "user", ":email": email },
    })
    return items.map((item) => stripKeys(item)).filter(Boolean)
  },

  async putAuditEvent(orgId: string, recordId: string, event: Record<string, unknown>) {
    const timestamp = Number(event.timestamp || Date.now())
    const eventId = String(event.id || `audit-${timestamp}`)
    const auditPk = orgAuditPk(orgId, recordId)
    const auditSk = `EVENT#${timestamp}#${eventId}`
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: itemForKey(auditPk, auditSk, "audit", {
          orgId,
          recordId,
          eventId,
          ...event,
          timestamp,
        }, eventId),
      })
    )
  },

  async putDemoSandboxMetric(metric: Record<string, unknown>) {
    const installId = String(metric.installId || "")
    const orgId = String(metric.orgId || "")
    const timestamp = Number(metric.timestamp || Date.now())
    if (!installId || !orgId) throw new Error("demo sandbox metric installId and orgId are required")
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: itemForKey(demoSandboxMetricPk(installId, orgId, timestamp), "PROFILE", "demo_sandbox_metric", {
          ...metric,
          timestamp,
        }),
      })
    )
  },
}
