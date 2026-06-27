import { createHash } from "node:crypto"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  ScanCommand,
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

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  })
)

const TABLE = process.env.DYNAMODB_TABLE || "FieldFlowRecords"
const AUDIT_TABLE = process.env.DYNAMODB_AUDIT_TABLE || "FieldFlowAudit"

function stripKeys<T>(item: (T & Record<string, unknown>) | undefined): T | undefined {
  if (!item) return undefined
  const { pk: _pk, sk: _sk, entityType: _entityType, ...rest } = item
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

export const dynamoStore = {
  async putRecord(record: RecordData) {
    const orgId = record.orgId
    if (!orgId) throw new Error("record.orgId is required")
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: orgRecordPk(orgId, record.id), sk: "PROFILE", entityType: "record", ...record },
      })
    )
  },

  async getRecord(id: string, orgId: string): Promise<RecordData | undefined> {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: orgRecordPk(orgId, id), sk: "PROFILE" },
      })
    )
    return stripKeys<RecordData>(result.Item as (RecordData & Record<string, unknown>) | undefined)
  },

  async deleteRecord(id: string, orgId: string) {
    await client.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { pk: orgRecordPk(orgId, id), sk: "PROFILE" },
      })
    )
  },

  async getRecordsByWorkflow(workflowId: string, orgId: string): Promise<RecordData[]> {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "entityType = :type AND orgId = :orgId AND workflowId = :workflowId",
        ExpressionAttributeValues: { ":type": "record", ":orgId": orgId, ":workflowId": workflowId },
      })
    )
    return (result.Items || []).map((item) => stripKeys<RecordData>(item as RecordData & Record<string, unknown>)!)
  },

  async listRecords(orgId: string): Promise<RecordData[]> {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "entityType = :type AND orgId = :orgId",
        ExpressionAttributeValues: { ":type": "record", ":orgId": orgId },
      })
    )
    return (result.Items || []).map((item) => stripKeys<RecordData>(item as RecordData & Record<string, unknown>)!)
  },

  async putWorkflow(workflow: WorkflowDefinition) {
    const orgId = workflow.orgId
    if (!orgId) throw new Error("workflow.orgId is required")
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: orgWorkflowPk(orgId, workflow.id), sk: "DEFINITION", entityType: "workflow", ...workflow },
      })
    )
  },

  async getWorkflow(id: string, orgId: string): Promise<WorkflowDefinition | undefined> {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: orgWorkflowPk(orgId, id), sk: "DEFINITION" },
      })
    )
    return stripKeys<WorkflowDefinition>(result.Item as (WorkflowDefinition & Record<string, unknown>) | undefined)
  },

  async listWorkflows(orgId: string): Promise<WorkflowDefinition[]> {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "entityType = :type AND orgId = :orgId",
        ExpressionAttributeValues: { ":type": "workflow", ":orgId": orgId },
      })
    )
    return (result.Items || []).map((item) => stripKeys<WorkflowDefinition>(item as WorkflowDefinition & Record<string, unknown>)!)
  },

  async putDevice(device: DeviceState) {
    if (!device.orgId) throw new Error("device.orgId is required")
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: orgDevicePk(device.orgId, device.device_id), sk: "STATE", entityType: "device", ...device },
      })
    )
  },

  async getDevice(deviceId: string, orgId: string): Promise<DeviceState | undefined> {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: orgDevicePk(orgId, deviceId), sk: "STATE" },
      })
    )
    return stripKeys<DeviceState>(result.Item as (DeviceState & Record<string, unknown>) | undefined)
  },

  async listDevices(orgId: string): Promise<DeviceState[]> {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "entityType = :type AND orgId = :orgId",
        ExpressionAttributeValues: { ":type": "device", ":orgId": orgId },
      })
    )
    return (result.Items || []).map((item) => stripKeys<DeviceState>(item as DeviceState & Record<string, unknown>)!)
  },

  async putConflict(conflict: ConflictRecord, orgId: string) {
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: orgConflictPk(orgId, conflict.id), sk: "PROFILE", entityType: "conflict", orgId, ...conflict },
      })
    )
  },

  async getConflict(id: string, orgId: string): Promise<ConflictRecord | undefined> {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: orgConflictPk(orgId, id), sk: "PROFILE" },
      })
    )
    return stripKeys<ConflictRecord>(result.Item as (ConflictRecord & Record<string, unknown>) | undefined)
  },

  async listOpenConflicts(orgId: string): Promise<ConflictRecord[]> {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "entityType = :type AND orgId = :orgId AND #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":type": "conflict", ":orgId": orgId, ":status": "OPEN" },
      })
    )
    return (result.Items || []).map((item) => stripKeys<ConflictRecord>(item as ConflictRecord & Record<string, unknown>)!)
  },

  async putInventoryItem(item: InventoryItem) {
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: orgInventoryPk(item.orgId, item.id), sk: "PROFILE", entityType: "inventory", ...item },
      })
    )
  },

  async getInventoryItem(id: string, orgId: string): Promise<InventoryItem | undefined> {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: orgInventoryPk(orgId, id), sk: "PROFILE" },
      })
    )
    return stripKeys<InventoryItem>(result.Item as (InventoryItem & Record<string, unknown>) | undefined)
  },

  async listInventoryItems(orgId: string): Promise<InventoryItem[]> {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "entityType = :type AND orgId = :orgId",
        ExpressionAttributeValues: { ":type": "inventory", ":orgId": orgId },
      })
    )
    return (result.Items || []).map((item) => stripKeys<InventoryItem>(item as InventoryItem & Record<string, unknown>)!)
  },

  async reserveInventory(
    itemId: string,
    idempotencyKey: string,
    qty: number,
    userId: string,
    orgId: string,
  ): Promise<{ success: boolean; error?: string; remaining?: number; contentHash?: string; competingRequestId?: string; currentStock?: number; retryRecommended?: boolean }> {
    const contentHash = createHash("sha256").update(`${orgId}|${itemId}|${qty}|${userId}|${idempotencyKey}`).digest("hex")
    const existingReceipt = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: orgInventoryReceiptPk(orgId, idempotencyKey), sk: "PROFILE" },
      })
    )
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
        pk: orgInventoryReceiptPk(orgId, idempotencyKey),
        sk: "PROFILE",
        entityType: "inventory_receipt",
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
                Item: receipt,
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Put: {
                TableName: TABLE,
                Item: { pk: orgInventoryLedgerPk(orgId, failureId), sk: "PROFILE", entityType: "inventory_ledger", ...ledger },
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
      pk: orgInventoryReceiptPk(orgId, idempotencyKey),
      sk: "PROFILE",
      entityType: "inventory_receipt",
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
                Item: receipt,
                ConditionExpression: "attribute_not_exists(pk)",
              },
            },
            {
              Update: {
                TableName: TABLE,
                Key: { pk: orgInventoryPk(orgId, itemId), sk: "PROFILE" },
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
                Item: { pk: orgInventoryLedgerPk(orgId, committedId), sk: "PROFILE", entityType: "inventory_ledger", ...ledger },
              },
            },
          ],
        })
      )
      return { success: true, contentHash, remaining }
    } catch (error) {
      const receiptAfterFailure = await client.send(
        new GetCommand({
          TableName: TABLE,
          Key: { pk: orgInventoryReceiptPk(orgId, idempotencyKey), sk: "PROFILE" },
        })
      )
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
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "entityType = :type AND orgId = :orgId",
        ExpressionAttributeValues: { ":type": "inventory_ledger", ":orgId": orgId },
      })
    )
    return (result.Items || []).map((item) => stripKeys<InventoryLedgerEntry>(item as InventoryLedgerEntry & Record<string, unknown>)!)
  },

  async putMutation(mutation: MutationEntry, orgId: string, serverSeq: number) {
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: orgMutationPk(orgId, mutation.client_id), sk: "PROFILE", entityType: "mutation", orgId, ...mutation, server_seq: serverSeq },
      })
    )
  },

  async hasMutation(clientId: string, orgId: string): Promise<boolean> {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: orgMutationPk(orgId, clientId), sk: "PROFILE" },
        ProjectionExpression: "pk",
      })
    )
    return !!result.Item
  },

  async getServerSince(orgId: string, seq: number): Promise<MutationEntry[]> {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "entityType = :type AND orgId = :orgId AND server_seq > :seq",
        ExpressionAttributeValues: { ":type": "mutation", ":orgId": orgId, ":seq": seq },
      })
    )
    return (result.Items || []).map((item) => stripKeys<MutationEntry>(item as MutationEntry & Record<string, unknown>)!)
  },

  async getCurrentSeq(orgId: string): Promise<number> {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "entityType = :type AND orgId = :orgId",
        ExpressionAttributeValues: { ":type": "mutation", ":orgId": orgId },
        ProjectionExpression: "server_seq",
      })
    )
    return Math.max(0, ...(result.Items || []).map((item) => Number(item.server_seq || 0)))
  },

  async putOrgItem(item: Record<string, unknown>) {
    const id = String(item.id || item.orgId || "")
    if (!id) throw new Error("org id is required")
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: `ORG#${id}`, sk: "PROFILE", entityType: "org", ...item },
      })
    )
  },

  async putUserProfile(item: Record<string, unknown>) {
    const orgId = String(item.orgId || "")
    const userId = String(item.userId || item.email || "")
    if (!orgId || !userId) throw new Error("user profile orgId and userId are required")
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: `ORG#${orgId}#USER#${userId}`, sk: "PROFILE", entityType: "user", ...item },
      })
    )
  },

  async listUserProfiles(orgId: string) {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "entityType = :type AND orgId = :orgId",
        ExpressionAttributeValues: { ":type": "user", ":orgId": orgId },
      })
    )
    return (result.Items || []).map((item) => stripKeys(item))
  },

  async getUserProfileByEmail(email: string) {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "entityType = :type AND email = :email",
        ExpressionAttributeValues: { ":type": "user", ":email": email },
        Limit: 1,
      })
    )
    return stripKeys((result.Items || [])[0])
  },

  async putAuditEvent(recordId: string, event: Record<string, unknown>) {
    await client.send(
      new PutCommand({
        TableName: AUDIT_TABLE,
        Item: {
          auditId: `AUDIT#${Date.now()}#${Math.random().toString(36).slice(2)}`,
          recordId,
          ...event,
          timestamp: Date.now(),
        },
      })
    )
  },
}
