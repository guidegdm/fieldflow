# Data Model

FieldFlow uses Amazon DynamoDB as its primary backend. The production table is `FieldFlowRecordsV2`, a single-table design with `pk` as the hash key, `sk` as the sort key, `PAY_PER_REQUEST` billing, and TTL on `expiresAt`. The expected table shape is captured in [scripts/dynamodb-v2-table.json](../scripts/dynamodb-v2-table.json:2) and environment defaults are documented in [.env.example](../.env.example:14).

There is no Aurora DSQL implementation in the current codebase. Critical inventory behavior is implemented with DynamoDB transactions.

## Table Shape

| Attribute | Purpose |
| --- | --- |
| `pk` | Primary partition key. |
| `sk` | Primary sort key. |
| `gsi1pk`, `gsi1sk` | Org-scoped entity lists, mutation cursors, conflict queues, inventory ledgers, demo metrics. |
| `gsi2pk`, `gsi2sk` | Email-to-user/workspace lookup. |
| `expiresAt` | DynamoDB TTL for demo rows and expiring rows. |

`itemForKey()` composes DynamoDB items and `stripKeys()` removes table metadata before returning domain objects. See [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:90) and [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:298).

## Main Entity Keys

| Entity | Key Pattern | Code |
| --- | --- | --- |
| Record | `ORG#{orgId}#RECORD#{id}` / `PROFILE` | [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:349) |
| Workflow | `ORG#{orgId}#WORKFLOW#{id}` / `DEFINITION` | [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:388) |
| Device | `ORG#{orgId}#DEVICE#{device_id}` / `STATE` | [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:412) |
| Conflict | `ORG#{orgId}#CONFLICT#{id}` / `PROFILE` | [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:435) |
| Inventory | `ORG#{orgId}#INVENTORY#{id}` / `PROFILE` | [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:458) |
| Mutation | `ORG#{orgId}#MUTATION#{client_id}` / `PROFILE` | [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:664) |
| Mutation sequence | `ORG#{orgId}#MUTATION_SEQ` / `PROFILE` | [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:689) |
| Org/workspace | `ORG#{id}` / `PROFILE` | [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:734) |
| User profile | `ORG#{orgId}#USER#{userId}` / `PROFILE` | [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:750) |
| Audit event | `ORG#{orgId}#AUDIT#{recordId}` / `EVENT#{timestamp}#{eventId}` | [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:787) |
| Demo metric | `DEMO#{installId}#SANDBOX#{orgId}#{timestamp}` / `PROFILE` | [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:806) |

## Access Patterns

Direct `Get` is used for point lookups. `gsi1` is queried for org-scoped lists, mutation deltas, open conflicts, audit rows, inventory ledger rows, and demo metrics. `gsi2` is queried for email lookup. Query helpers are in [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:217), [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:235), and [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:283).

The adapter has compatibility flags for legacy key shapes, but production is expected to require composite `pk`/`sk` keys. Current controls include `DYNAMODB_SORT_KEY_ENABLED`, `DYNAMODB_REQUIRE_COMPOSITE_KEY`, `DYNAMODB_HASH_KEY`, and `DYNAMODB_RANGE_KEY` in [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:40).

## Inventory Transactions

Inventory reservations use `TransactWriteCommand`. A successful reservation writes:

- an idempotency receipt,
- a conditional inventory update that increments `reserved`,
- an inventory ledger entry.

The transaction path is in [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:597). Failure paths still write receipt/ledger rows for serialization failures in [src/lib/api/dynamo-store.ts](../src/lib/api/dynamo-store.ts:537).

The sync batch route invokes this reservation logic when a workflow transition declares an inventory side effect in [src/app/api/sync/batch/route.ts](../src/app/api/sync/batch/route.ts:401).

## Demo TTL And Metrics

Demo sandboxes are seeded with `expiresAt = now + 7 days` in [src/lib/demo/seed-demo-org.ts](../src/lib/demo/seed-demo-org.ts:309). TTL is attached to demo orgs, workflows, records, devices, user profiles, inventory rows, audit rows, and metrics.

The seed writes both a `demo_sandbox_login` audit event and a `demo_sandbox_metric` row in [src/lib/demo/seed-demo-org.ts](../src/lib/demo/seed-demo-org.ts:427).

## S3 Attachments

Photo evidence is stored in S3, not DynamoDB. The app validates the target workflow, record, and field, then returns a presigned PUT URL from [src/app/api/attachments/presign/route.ts](../src/app/api/attachments/presign/route.ts:87).

Object keys are org-scoped:

```text
orgs/{orgId}/workflows/{workflowId}/records/{recordId}/fields/{fieldKey}/{attachmentId}.webp
```

The client compresses/uploads through [src/lib/attachments/upload.ts](../src/lib/attachments/upload.ts:7), and pending attachments are retried from IndexedDB by [src/lib/attachments/sync-pending.ts](../src/lib/attachments/sync-pending.ts:33).

## In-Memory Fallback

If `DYNAMODB_ENABLED=false`, or the DynamoDB adapter cannot be loaded, [src/lib/api/in-memory-store.ts](../src/lib/api/in-memory-store.ts:7) uses JavaScript maps for local process storage. This is useful for development fallback but has no persistence, no DynamoDB TTL, and only process-local concurrency semantics.

