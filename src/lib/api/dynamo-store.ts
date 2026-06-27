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

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials:
      process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  })
)

const TABLE = process.env.DYNAMODB_TABLE || "FieldFlowRecords"

export const dynamoStore = {
  async putRecord(record: RecordData) {
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: `RECORD#${record.id}`, sk: "PROFILE", ...record },
        ConditionExpression: "attribute_not_exists(pk)",
      })
    )
  },

  async getRecord(id: string): Promise<RecordData | undefined> {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `RECORD#${id}`, sk: "PROFILE" },
      })
    )
    return result.Item as RecordData | undefined
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
    await client.send(
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
    await client.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { pk: `RECORD#${id}`, sk: "PROFILE" },
      })
    )
  },

  async getRecordsByWorkflow(workflowId: string): Promise<RecordData[]> {
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "workflow-index",
        KeyConditionExpression: "workflowId = :wid",
        ExpressionAttributeValues: { ":wid": workflowId },
      })
    )
    return (result.Items || []) as RecordData[]
  },

  async listRecords(): Promise<RecordData[]> {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "begins_with(pk, :prefix)",
        ExpressionAttributeValues: { ":prefix": "RECORD#" },
      })
    )
    return (result.Items || []) as RecordData[]
  },

  async putWorkflow(workflow: WorkflowDefinition) {
    await client.send(
      new PutCommand({
        TableName: TABLE,
        Item: { pk: `WORKFLOW#${workflow.id}`, sk: "DEFINITION", ...workflow },
      })
    )
  },

  async getWorkflow(id: string): Promise<WorkflowDefinition | undefined> {
    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { pk: `WORKFLOW#${id}`, sk: "DEFINITION" },
      })
    )
    return result.Item as WorkflowDefinition | undefined
  },

  async listWorkflows(): Promise<WorkflowDefinition[]> {
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: "begins_with(pk, :prefix)",
        ExpressionAttributeValues: { ":prefix": "WORKFLOW#" },
      })
    )
    return (result.Items || []) as WorkflowDefinition[]
  },

  async putAuditEvent(recordId: string, event: Record<string, unknown>) {
    await client.send(
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

  async putOrgItem(item: Record<string, unknown>) {
    await client.send(
      new PutCommand({
        TableName: "FieldFlowOrgs",
        Item: item,
      })
    )
  },

  async queryAuditEvents(recordId: string, limit = 50) {
    const result = await client.send(
      new QueryCommand({
        TableName: "FieldFlowAudit",
        KeyConditionExpression: "recordId = :rid",
        ExpressionAttributeValues: { ":rid": recordId },
        Limit: limit,
        ScanIndexForward: false,
      })
    )
    return result.Items || []
  },

  async putSyncEvent(data: Record<string, unknown>) {
    await client.send(
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
