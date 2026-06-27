import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb"
import type { RecordData } from "@/types/record"
import type { WorkflowDefinition } from "@/types/workflow"

let _client: DynamoDBDocumentClient | null = null
function getClient(): DynamoDBDocumentClient | null {
  if (!_client) {
    try {
      if (!process.env.AWS_REGION) return null
      _client = DynamoDBDocumentClient.from(
        new DynamoDBClient({
          region: process.env.AWS_REGION,
          credentials:
            process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
              ? {
                  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                }
              : undefined,
        })
      )
    } catch {
      return null
    }
  }
  return _client
}

const TABLE = process.env.DYNAMODB_TABLE || "FieldFlowRecords"

export const dynamoStore = {
  async putRecord(record: RecordData) {
    await getClient()?.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: `RECORD#${record.id}`, sk: "PROFILE", ...record },
        ConditionExpression: "attribute_not_exists(pk)",
      })
    )
  },

  async getRecord(id: string): Promise<RecordData | undefined> {
    const result = await getClient()?.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `RECORD#${id}`, sk: "PROFILE" },
      })
    )
    return result?.Item as RecordData | undefined
  },

  async updateRecord(id: string, updates: Partial<RecordData>) {
    const updateExpression =
      "SET " +
      Object.keys(updates)
        .map((k) => `#${k} = :${k}`)
        .join(", ")
    const expressionAttributeNames = Object.fromEntries(
      Object.keys(updates).map((k) => [`#${k}`, k])
    )
    const expressionAttributeValues = Object.fromEntries(
      Object.entries(updates).map(([k, v]) => [`:${k}`, v])
    )
    await getClient()?.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          pk: `RECORD#${id}`,
          sk: "PROFILE",
          ...updates,
          id,
        },
      })
    )
  },

  async deleteRecord(id: string) {
    await getClient()?.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { pk: `RECORD#${id}`, sk: "PROFILE" },
      })
    )
  },

  async getRecordsByWorkflow(workflowId: string): Promise<RecordData[]> {
    const result = await getClient()?.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "workflow-index",
        KeyConditionExpression: "workflowId = :wid",
        ExpressionAttributeValues: { ":wid": workflowId },
      })
    )
    return (result?.Items || []) as RecordData[]
  },

  async listRecords(): Promise<RecordData[]> {
    const result = await getClient()?.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "begins_with(pk, :prefix)",
        ExpressionAttributeValues: { ":prefix": "RECORD#" },
      })
    )
    return (result?.Items || []) as RecordData[]
  },

  async putWorkflow(workflow: WorkflowDefinition) {
    await getClient()?.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: `WORKFLOW#${workflow.id}`, sk: "DEFINITION", ...workflow },
      })
    )
  },

  async getWorkflow(id: string): Promise<WorkflowDefinition | undefined> {
    const result = await getClient()?.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `WORKFLOW#${id}`, sk: "DEFINITION" },
      })
    )
    return result?.Item as WorkflowDefinition | undefined
  },

  async listWorkflows(): Promise<WorkflowDefinition[]> {
    const result = await getClient()?.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "begins_with(pk, :prefix)",
        ExpressionAttributeValues: { ":prefix": "WORKFLOW#" },
      })
    )
    return (result?.Items || []) as WorkflowDefinition[]
  },

  async putAuditEvent(recordId: string, event: Record<string, unknown>) {
    await getClient()?.send(
      new PutCommand({
        TableName: "FieldFlowAudit",
        Item: {
          auditId: `AUDIT#${Date.now()}#${Math.random().toString(36).slice(2)}`,
          recordId,
          ...event,
          timestamp: Date.now(),
        },
      })
    )
  },

  async queryAuditEvents(recordId: string, limit = 50) {
    const result = await getClient()?.send(
      new QueryCommand({
        TableName: "FieldFlowAudit",
        KeyConditionExpression: "recordId = :rid",
        ExpressionAttributeValues: { ":rid": recordId },
        Limit: limit,
        ScanIndexForward: false,
      })
    )
    return result?.Items || []
  },

  async putSyncEvent(data: Record<string, unknown>) {
    await getClient()?.send(
      new PutCommand({
        TableName: "FieldFlowSync",
        Item: {
          syncId: `SYNC#${Date.now()}#${Math.random().toString(36).slice(2)}`,
          ...data,
          timestamp: Date.now(),
        },
      })
    )
  },
}
