# DynamoDB Access Model Audit

## 2026-06-30 Migration Update

This report captured the pre-remediation state. The `audit` branch now creates
and targets `FieldFlowRecordsV2`, a DynamoDB single table with `pk` as the hash
key, `sk` as the range key, TTL on `expiresAt`, and `gsi1`/`gsi2` access paths.

Migration verification:
- `FieldFlowRecordsV2` exists in `us-east-1` with `pk/sk`, `gsi1`, and `gsi2`.
- TTL is enabled on `expiresAt`.
- The legacy `FieldFlowRecords` table was backfilled into V2 with 6408 copied items.
- Direct `pk/sk`, org-scoped `gsi1`, and email-scoped `gsi2` queries were verified.
- Vercel production and preview env values now point at `FieldFlowRecordsV2`.
- The Vercel runtime IAM user allows DynamoDB V2 table/index access.

The historical findings below remain useful as context, but the table-shape,
scan-only access, fire-and-forget record write, and missing demo TTL findings
have been addressed in later commits on this branch.

Source diagram: `docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd`

Audited implementation: `src/lib/api/dynamo-store.ts`, `src/lib/api/in-memory-store.ts`, sync/workflow/auth/inventory routes, demo seed code, S3 presign route, and shared types.

## Executive Summary

The diagram is directionally accurate about the entity families and most primary key strings, but it overstates the maturity of the access model. The adapter has no `QueryCommand` or `IndexName` usage and implements normal list/cursor/email reads as table scans through `scanAll` (`src/lib/api/dynamo-store.ts:160`, `src/lib/api/dynamo-store.ts:165`, `src/lib/api/dynamo-store.ts:167`). There are no visible GSIs in code, and the line claiming "DynamoDB table/index access" is therefore not evidenced by the implementation (`docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:24`).

The largest correctness issues are:

1. `putRecordForOrg` is fire-and-forget when DynamoDB is enabled, so API routes can ack mutations after the in-memory cache is updated even if the DynamoDB record write later fails (`src/lib/api/in-memory-store.ts:46`, `src/lib/api/in-memory-store.ts:47`, `src/app/api/sync/batch/route.ts:169`, `src/app/api/sync/batch/route.ts:170`).
2. Mutation idempotency is check-then-write and sequence assignment is process-local, so concurrent duplicate sync requests or multiple serverless instances can produce duplicated effects, duplicate or non-monotonic `server_seq`, and unordered cursor responses (`src/app/api/sync/batch/route.ts:118`, `src/lib/api/in-memory-store.ts:97`, `src/lib/api/in-memory-store.ts:100`, `src/lib/api/dynamo-store.ts:535`, `src/lib/api/dynamo-store.ts:539`).
3. If the table is hash-only, as the README sample currently sets with `DYNAMODB_SORT_KEY_ENABLED=false`, the diagram's sort-key audit model cannot hold multiple audit events per `ORG#...#AUDIT#...` partition; later events overwrite earlier events under the same hash key (`README.md:146`, `src/lib/api/dynamo-store.ts:50`, `src/lib/api/dynamo-store.ts:51`, `src/lib/api/dynamo-store.ts:619`, `src/lib/api/dynamo-store.ts:623`).
4. TTL claims are incomplete. Seeded demo baseline data gets `expiresAt`, and inventory receipts/ledger copy item expiry, but sync-created records, mutations, manual conflicts, most conflict audit events, and conflict-resolution mutations do not consistently carry demo expiry (`src/app/api/sync/batch/route.ts:152`, `src/app/api/sync/batch/route.ts:168`, `src/types/sync.ts:4`, `src/types/sync.ts:12`, `src/types/sync.ts:85`, `src/types/sync.ts:90`).
5. Inventory reservations use a DynamoDB transaction, which is the strongest part of the model, but the idempotency receipt does not validate that a replay with the same key has the same request body, and the DynamoDB path does not write the audit entity implied by the diagram (`src/lib/api/dynamo-store.ts:361`, `src/lib/api/dynamo-store.ts:362`, `src/lib/api/dynamo-store.ts:363`, `src/lib/api/dynamo-store.ts:368`, `docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:40`).

## Diagram Claim Check

| Diagram claim | Status | Evidence |
|---|---|---|
| Table is `FieldFlowRecords`. | Implemented by default. | `TABLE` defaults to `FieldFlowRecords` at `src/lib/api/dynamo-store.ts:37`; diagram labels the table the same at `docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:3`. |
| Runtime key schema detection uses `DescribeTable` and pk/sk or pk automatically. | Partially true, risky. | The adapter uses env overrides, `DYNAMODB_SORT_KEY_ENABLED`, then `DescribeTableCommand` (`src/lib/api/dynamo-store.ts:46`, `src/lib/api/dynamo-store.ts:54`). On key errors it mutates a process-wide override and can fall back to scanning by `pk`/`sk` (`src/lib/api/dynamo-store.ts:101`, `src/lib/api/dynamo-store.ts:108`, `src/lib/api/dynamo-store.ts:124`, `src/lib/api/dynamo-store.ts:125`). This can hide schema mistakes. |
| `org`, `user`, `workflow`, `record`, `device`, `mutation`, `conflict`, `inventory`, `inventory_receipt`, `inventory_ledger`, `audit`, and `demo_sandbox_metric` entity types exist. | Mostly implemented. | Key helpers match the diagram for records, workflows, devices, conflicts, inventory, receipts, ledger, mutations, audit, and demo metrics (`src/lib/api/dynamo-store.ts:185`, `src/lib/api/dynamo-store.ts:189`, `src/lib/api/dynamo-store.ts:193`, `src/lib/api/dynamo-store.ts:197`, `src/lib/api/dynamo-store.ts:201`, `src/lib/api/dynamo-store.ts:205`, `src/lib/api/dynamo-store.ts:209`, `src/lib/api/dynamo-store.ts:213`, `src/lib/api/dynamo-store.ts:217`, `src/lib/api/dynamo-store.ts:221`). Org and user writes use `ORG#${id}` and `ORG#${orgId}#USER#${userId}` (`src/lib/api/dynamo-store.ts:572`, `src/lib/api/dynamo-store.ts:589`). |
| Every runtime read/write carries `orgId`. | Mostly true for tenant data, false for some access patterns. | Core entity methods require or inject org id, for example record get/write (`src/lib/api/dynamo-store.ts:226`, `src/lib/api/dynamo-store.ts:228`, `src/lib/api/dynamo-store.ts:237`). User membership lookup by email scans across all orgs (`src/lib/api/dynamo-store.ts:602`, `src/lib/api/dynamo-store.ts:604`, `src/lib/api/dynamo-store.ts:611`, `src/lib/api/dynamo-store.ts:613`). Demo metrics use a `DEMO#...` pk but include `orgId` (`src/lib/api/dynamo-store.ts:638`, `src/lib/api/dynamo-store.ts:640`, `src/lib/api/dynamo-store.ts:646`). |
| DynamoDB TTL uses `expiresAt` on demo records, workflows, users, devices, inventory, receipts, ledger, and sandbox metrics. | Partially true. | Seeded orgs/workflows/records/inventory/users/devices/metrics get `expiresAt` (`src/lib/demo/seed-demo-org.ts:309`, `src/lib/demo/seed-demo-org.ts:325`, `src/lib/demo/seed-demo-org.ts:328`, `src/lib/demo/seed-demo-org.ts:341`, `src/lib/demo/seed-demo-org.ts:343`, `src/lib/demo/seed-demo-org.ts:362`, `src/lib/demo/seed-demo-org.ts:376`, `src/lib/demo/seed-demo-org.ts:448`). Inventory receipts and ledger copy `item.expiresAt` (`src/lib/api/dynamo-store.ts:391`, `src/lib/api/dynamo-store.ts:406`, `src/lib/api/dynamo-store.ts:453`, `src/lib/api/dynamo-store.ts:465`). Sync-created records/mutations/conflicts do not consistently carry expiry. |
| Mutation, conflict, and ledger emit audit records. | Partially false. | Conflict auto-resolution/escalation emits audit events in sync (`src/app/api/sync/batch/route.ts:270`, `src/app/api/sync/batch/route.ts:272`). The DynamoDB inventory transaction writes receipts and ledger entries but no audit item (`src/lib/api/dynamo-store.ts:470`, `src/lib/api/dynamo-store.ts:495`). Mutation writes also do not emit audit records (`src/lib/api/dynamo-store.ts:535`, `src/lib/api/dynamo-store.ts:539`). |
| S3 object keys are org/workflow/record/field scoped. | Implemented, but not fully verified against records. | Presign constructs `orgs/{orgId}/workflows/{workflowId}/records/{recordId}/fields/{fieldKey}/{attachmentId}.webp` (`src/app/api/attachments/presign/route.ts:102`, `src/app/api/attachments/presign/route.ts:111`). The route does not verify that the workflow/record belongs to the current org before signing. |
| S3 objects use SSE-S3 encryption. | Not implemented in the visible presign code. | The signed headers are only `host` (`src/app/api/attachments/presign/route.ts:61`), and the response provides only key/url/expiry (`src/app/api/attachments/presign/route.ts:124`). No `x-amz-server-side-encryption` header is signed. |

## Actual Access Pattern Matrix

| Entity | Write key | Read/list pattern | Risks |
|---|---|---|---|
| Org | `pk=ORG#id`, `sk=PROFILE`, `entityType=org` (`src/lib/api/dynamo-store.ts:566`, `src/lib/api/dynamo-store.ts:572`) | `sendGet(ORG#id, PROFILE)` (`src/lib/api/dynamo-store.ts:577`, `src/lib/api/dynamo-store.ts:578`) | Blind `PutCommand`; org plus initial admin profile is not transactional (`src/app/api/auth/confirm-signup/route.ts:69`, `src/app/api/auth/confirm-signup/route.ts:70`). |
| User/invite | `pk=ORG#orgId#USER#userId`, `sk=PROFILE`, `entityType=user` (`src/lib/api/dynamo-store.ts:582`, `src/lib/api/dynamo-store.ts:589`) | Org users scan by `entityType` and `orgId`; email membership scans by `email` (`src/lib/api/dynamo-store.ts:594`, `src/lib/api/dynamo-store.ts:596`, `src/lib/api/dynamo-store.ts:602`, `src/lib/api/dynamo-store.ts:604`) | Invites are user rows with `invited: true`, not separate invite entities (`src/app/api/admin/users/route.ts:111`, `src/app/api/admin/users/route.ts:118`). Re-invites overwrite. Email lookup does not scale without GSI. |
| Workflow | `pk=ORG#orgId#WORKFLOW#wfId`, `sk=DEFINITION` (`src/lib/api/dynamo-store.ts:262`, `src/lib/api/dynamo-store.ts:268`) | Get by key; list scans by `entityType` and `orgId` (`src/lib/api/dynamo-store.ts:273`, `src/lib/api/dynamo-store.ts:278`, `src/lib/api/dynamo-store.ts:280`) | Concurrent definition saves/publishes can lose updates because writes are unconditional (`src/app/api/workflows/[id]/definition/route.ts:65`, `src/app/api/workflows/[id]/publish/route.ts:18`, `src/app/api/workflows/[id]/publish/route.ts:22`). |
| Record | `pk=ORG#orgId#RECORD#recordId`, `sk=PROFILE` (`src/lib/api/dynamo-store.ts:226`, `src/lib/api/dynamo-store.ts:232`) | Get/delete by key; list and workflow list scan (`src/lib/api/dynamo-store.ts:237`, `src/lib/api/dynamo-store.ts:246`, `src/lib/api/dynamo-store.ts:248`, `src/lib/api/dynamo-store.ts:254`, `src/lib/api/dynamo-store.ts:256`) | `putRecordForOrg` does not await DynamoDB (`src/lib/api/in-memory-store.ts:46`, `src/lib/api/in-memory-store.ts:47`); update conflicts use app-level version checks but blind puts (`src/app/api/sync/batch/route.ts:184`, `src/app/api/sync/batch/route.ts:299`, `src/app/api/sync/batch/route.ts:304`). |
| Device | `pk=ORG#orgId#DEVICE#deviceId`, `sk=STATE` (`src/lib/api/dynamo-store.ts:286`, `src/lib/api/dynamo-store.ts:291`) | Get by key; list scans (`src/lib/api/dynamo-store.ts:296`, `src/lib/api/dynamo-store.ts:301`, `src/lib/api/dynamo-store.ts:303`) | Device sync state is blind overwritten and demo expiry is only preserved if an existing device already had it (`src/app/api/sync/batch/route.ts:357`, `src/app/api/sync/batch/route.ts:359`, `src/app/api/sync/batch/route.ts:370`). |
| Mutation | `pk=ORG#orgId#MUTATION#clientId`, `sk=PROFILE`, `server_seq` (`src/lib/api/dynamo-store.ts:535`, `src/lib/api/dynamo-store.ts:539`) | Idempotency get by key; cursor reads scan by `server_seq`; current seq scans max (`src/lib/api/dynamo-store.ts:544`, `src/lib/api/dynamo-store.ts:549`, `src/lib/api/dynamo-store.ts:551`, `src/lib/api/dynamo-store.ts:557`, `src/lib/api/dynamo-store.ts:559`) | Check-then-write idempotency; `server_seq` comes from process-local memory (`src/lib/api/in-memory-store.ts:97`, `src/lib/api/in-memory-store.ts:100`). Scan results are not ordered. |
| Conflict | `pk=ORG#orgId#CONFLICT#conflictId`, `sk=PROFILE` (`src/lib/api/dynamo-store.ts:309`, `src/lib/api/dynamo-store.ts:313`) | Get by key; open list scans by `entityType`, `orgId`, and status (`src/lib/api/dynamo-store.ts:318`, `src/lib/api/dynamo-store.ts:323`, `src/lib/api/dynamo-store.ts:325`) | No `expiresAt` in `ConflictRecord`; resolution updates conflict rows and records with blind writes (`src/types/sync.ts:85`, `src/types/sync.ts:90`, `src/app/api/sync/conflict/route.ts:75`, `src/app/api/sync/conflict/route.ts:81`, `src/app/api/sync/conflict/route.ts:88`). |
| Inventory | `pk=ORG#orgId#INVENTORY#itemId`, `sk=PROFILE` (`src/lib/api/dynamo-store.ts:332`, `src/lib/api/dynamo-store.ts:336`) | Get by key; list scans (`src/lib/api/dynamo-store.ts:341`, `src/lib/api/dynamo-store.ts:346`, `src/lib/api/dynamo-store.ts:348`) | Reservation is transactional, but inventory item updates outside reservation are blind puts. |
| Inventory receipt | `pk=ORG#orgId#INVENTORY_RECEIPT#idempotencyKey`, `sk=PROFILE` (`src/lib/api/dynamo-store.ts:205`, `src/lib/api/dynamo-store.ts:414`, `src/lib/api/dynamo-store.ts:475`) | `sendGet` before and after transaction (`src/lib/api/dynamo-store.ts:362`, `src/lib/api/dynamo-store.ts:503`) | Existing receipt is returned without comparing same idempotency key to same semantic request (`src/lib/api/dynamo-store.ts:363`, `src/lib/api/dynamo-store.ts:368`). |
| Inventory ledger | `pk=ORG#orgId#INVENTORY_LEDGER#ledgerId`, `sk=PROFILE` (`src/lib/api/dynamo-store.ts:209`, `src/lib/api/dynamo-store.ts:421`, `src/lib/api/dynamo-store.ts:495`) | List scans by `entityType` and `orgId` (`src/lib/api/dynamo-store.ts:527`, `src/lib/api/dynamo-store.ts:529`) | No queryable sort key by time; `InventoryLedgerEntry` type omits `orgId` and `expiresAt` even though Dynamo writes add them (`src/types/sync.ts:64`, `src/types/sync.ts:76`, `src/lib/api/dynamo-store.ts:452`, `src/lib/api/dynamo-store.ts:453`). |
| Audit | `pk=ORG#orgId#AUDIT#recordOrItemId`, `sk=EVENT#timestamp#eventId` (`src/lib/api/dynamo-store.ts:217`, `src/lib/api/dynamo-store.ts:622`, `src/lib/api/dynamo-store.ts:623`) | Write-only in adapter; no list/read method | Requires a range key to retain multiple events per audited record/item. Hash-only table mode collapses events onto one key. |
| Demo metric | `pk=DEMO#installId#SANDBOX#orgId#timestamp`, `sk=PROFILE` (`src/lib/api/dynamo-store.ts:221`, `src/lib/api/dynamo-store.ts:646`) | Write-only in adapter | Metrics are not queryable without scans or external tooling; TTL depends on the metric carrying `expiresAt` from seed (`src/lib/demo/seed-demo-org.ts:441`, `src/lib/demo/seed-demo-org.ts:448`). |

## Findings

### Critical: record writes can be acknowledged before DynamoDB persistence

`putRecordForOrg` starts the DynamoDB write through `getDynamo().then(...)` and immediately updates the local map (`src/lib/api/in-memory-store.ts:46`, `src/lib/api/in-memory-store.ts:47`, `src/lib/api/in-memory-store.ts:48`). Sync create/update routes `await` this method and then write the mutation receipt (`src/app/api/sync/batch/route.ts:169`, `src/app/api/sync/batch/route.ts:170`, `src/app/api/sync/batch/route.ts:304`, `src/app/api/sync/batch/route.ts:305`). Conflict resolution does the same before creating a mutation (`src/app/api/sync/conflict/route.ts:88`, `src/app/api/sync/conflict/route.ts:106`).

Impact: the API can return an ack and a durable mutation cursor while the record write has failed, is still in flight, or is lost when the serverless invocation ends. This directly undermines the diagram's `Record -> Mutation` relationship (`docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:32`) because the mutation can outlive the record change.

Recommendation: make `putRecordForOrg` await `dynamo.putRecord`, and ideally write record plus mutation/idempotency receipt in one `TransactWriteCommand` with conditional expressions.

### Critical: mutation idempotency and sequence allocation are not atomic

The sync route checks `hasMutationForOrg` before applying each operation (`src/app/api/sync/batch/route.ts:118`) and stores the mutation after applying workflow or record changes (`src/app/api/sync/batch/route.ts:132`, `src/app/api/sync/batch/route.ts:170`, `src/app/api/sync/batch/route.ts:305`, `src/app/api/sync/batch/route.ts:334`). The Dynamo mutation write is an unconditional `PutCommand` (`src/lib/api/dynamo-store.ts:535`, `src/lib/api/dynamo-store.ts:537`, `src/lib/api/dynamo-store.ts:539`). `server_seq` is incremented in memory per process (`src/lib/api/in-memory-store.ts:37`, `src/lib/api/in-memory-store.ts:97`, `src/lib/api/in-memory-store.ts:99`, `src/lib/api/in-memory-store.ts:100`).

Impact: two concurrent requests with the same `client_id` can both pass the read check and apply the operation. Multiple serverless instances can generate overlapping `server_seq` values. `getServerSince` scans by `server_seq > :seq` and returns scan order, not sequence order (`src/lib/api/dynamo-store.ts:549`, `src/lib/api/dynamo-store.ts:551`, `src/lib/api/dynamo-store.ts:554`), so cursor clients can miss or receive changes out of order.

Recommendation: create a per-org sequence/counter item or use a mutation receipt item whose conditional put happens before side effects. Store mutations under a key that supports ordered query by org and sequence, for example `pk=ORG#id#MUTATIONS`, `sk=SEQ#000000001#clientId`, or add a GSI with `gsi1pk=ORG#id#MUTATION` and `gsi1sk=server_seq`.

### Critical: hash-only table compatibility breaks audit history

The diagram models audit as one partition per record/item with event sort keys (`docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:15`). The adapter writes audit rows with `auditPk=ORG#orgId#AUDIT#recordId` and `auditSk=EVENT#timestamp#eventId` (`src/lib/api/dynamo-store.ts:619`, `src/lib/api/dynamo-store.ts:622`, `src/lib/api/dynamo-store.ts:623`, `src/lib/api/dynamo-store.ts:627`). However the documented local env sample sets `DYNAMODB_SORT_KEY_ENABLED=false` (`README.md:146`), and the adapter supports hash-only mode by using only `{ pk }` (`src/lib/api/dynamo-store.ts:50`, `src/lib/api/dynamo-store.ts:51`, `src/lib/api/dynamo-store.ts:65`, `src/lib/api/dynamo-store.ts:66`).

Impact: on a hash-only table, all audit events for the same `ORG#...#AUDIT#recordOrItemId` overwrite each other. The stored `sk` attribute remains present, but it is not part of the table key.

Recommendation: require the production table to use `pk` as HASH and `sk` as RANGE, or change audit pk to include the event id when running hash-only. Remove the README sample that encourages `DYNAMODB_SORT_KEY_ENABLED=false` unless it is explicitly only for a legacy local table.

### High: normal reads are scans, not access-pattern queries

List reads for records, workflows, devices, conflicts, inventory, inventory ledger, mutations, user profiles, and email lookup all use `ScanCommand` filters (`src/lib/api/dynamo-store.ts:246`, `src/lib/api/dynamo-store.ts:254`, `src/lib/api/dynamo-store.ts:278`, `src/lib/api/dynamo-store.ts:301`, `src/lib/api/dynamo-store.ts:323`, `src/lib/api/dynamo-store.ts:346`, `src/lib/api/dynamo-store.ts:527`, `src/lib/api/dynamo-store.ts:549`, `src/lib/api/dynamo-store.ts:557`, `src/lib/api/dynamo-store.ts:594`, `src/lib/api/dynamo-store.ts:602`, `src/lib/api/dynamo-store.ts:611`). This contradicts the implication that a single-table access model has been shaped around key queries.

Impact: tenant list pages, sync cursors, login membership resolution, and dashboards become full-table operations. Filtering by `orgId` is application-level, not a partition-key boundary. As data grows, scans can become expensive, slow, and throttling-prone.

Recommendation: introduce queryable access paths. Minimum set:

- `gsi1pk=ORG#orgId#ENTITY#record`, `gsi1sk=workflowId#updatedAt#recordId` for record lists and workflow records.
- `gsi1pk=ORG#orgId#ENTITY#workflow`, `gsi1sk=status#updatedAt#workflowId` for workflow lists.
- `gsi1pk=ORG#orgId#MUTATION`, `gsi1sk=server_seq#clientId` for sync.
- `gsi1pk=USER_EMAIL#email`, `gsi1sk=ORG#orgId` for membership lookup.
- `gsi1pk=ORG#orgId#CONFLICT#OPEN`, `gsi1sk=created_at#conflictId` for conflict queues.
- `gsi1pk=ORG#orgId#INVENTORY_LEDGER`, `gsi1sk=timestamp#ledgerId` for ledger views.

### High: TTL model is incomplete for realistic demo use

Seeded demo baseline data gets a seven-day `expiresAt` (`src/lib/demo/seed-demo-org.ts:309`). Org, workflows, records, inventory, users, devices, audit login events, and metrics are stamped during seed (`src/lib/demo/seed-demo-org.ts:325`, `src/lib/demo/seed-demo-org.ts:328`, `src/lib/demo/seed-demo-org.ts:341`, `src/lib/demo/seed-demo-org.ts:343`, `src/lib/demo/seed-demo-org.ts:362`, `src/lib/demo/seed-demo-org.ts:376`, `src/lib/demo/seed-demo-org.ts:437`, `src/lib/demo/seed-demo-org.ts:448`). Inventory receipts and ledger copy expiry from the inventory item (`src/lib/api/dynamo-store.ts:391`, `src/lib/api/dynamo-store.ts:406`, `src/lib/api/dynamo-store.ts:453`, `src/lib/api/dynamo-store.ts:465`).

But sync-created records are built without `expiresAt` (`src/app/api/sync/batch/route.ts:152`, `src/app/api/sync/batch/route.ts:168`). `MutationEntry` has no expiry field (`src/types/sync.ts:4`, `src/types/sync.ts:12`), and `putMutation` stores only `{ orgId, ...mutation, server_seq }` (`src/lib/api/dynamo-store.ts:535`, `src/lib/api/dynamo-store.ts:539`). `ConflictRecord` has no expiry field (`src/types/sync.ts:85`, `src/types/sync.ts:90`), and manual conflict rows are written without expiry (`src/app/api/sync/batch/route.ts:307`, `src/app/api/sync/batch/route.ts:320`). Device sync preserves expiry only from an existing device (`src/app/api/sync/batch/route.ts:357`, `src/app/api/sync/batch/route.ts:370`).

Impact: demo workspaces can leave behind mutations, conflicts, records, and audit events even if table TTL is enabled. The diagram's TTL claim is therefore only true for initial seed data and inventory artifacts that inherit an expiring item (`docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:43`).

Recommendation: centralize demo expiry resolution by org id and inject `expiresAt` into every demo-scoped write, including mutations, conflicts, audit events, and user-created records. Also add infrastructure or a runtime check that DynamoDB TTL is actually enabled on the table; the repo only documents the attribute (`.env.example:15`, `.env.example:16`).

### High: table schema fallback can mask production misconfiguration

`tableKeyShape` returns env-driven shapes, then `DescribeTable`, then falls back to `{ hashName: "id" }` if describe fails (`src/lib/api/dynamo-store.ts:46`, `src/lib/api/dynamo-store.ts:61`). `sendGet` catches key-schema errors and tries `{ id }`, `{ pk }`, and `{ pk, sk }`, updating process-wide overrides (`src/lib/api/dynamo-store.ts:100`, `src/lib/api/dynamo-store.ts:101`, `src/lib/api/dynamo-store.ts:108`, `src/lib/api/dynamo-store.ts:109`). If those fail, it scans by stored `pk`/`sk` attributes (`src/lib/api/dynamo-store.ts:124`, `src/lib/api/dynamo-store.ts:125`).

Impact: a wrong table schema can appear to work for point reads while using scans or process-local shape overrides. Different serverless instances can settle on different key-shape overrides based on first error path. Delete fallback is narrower than get fallback and does not scan (`src/lib/api/dynamo-store.ts:137`, `src/lib/api/dynamo-store.ts:148`, `src/lib/api/dynamo-store.ts:151`).

Recommendation: fail fast on table schema mismatch in production. Keep compatibility fallback only for a named migration mode, log it loudly, and add a startup/table-health endpoint that asserts `pk` HASH and `sk` RANGE where the diagram requires it.

### High: org scoping is mostly application-level, not key-enforced for lists

Core item keys are org-prefixed, which is good (`src/lib/api/dynamo-store.ts:185`, `src/lib/api/dynamo-store.ts:189`, `src/lib/api/dynamo-store.ts:193`, `src/lib/api/dynamo-store.ts:197`, `src/lib/api/dynamo-store.ts:201`, `src/lib/api/dynamo-store.ts:213`). However most list reads scan the full table and filter by an `orgId` attribute rather than querying an org partition. Membership by email scans across all orgs (`src/lib/api/dynamo-store.ts:602`, `src/lib/api/dynamo-store.ts:604`, `src/lib/api/dynamo-store.ts:611`, `src/lib/api/dynamo-store.ts:613`).

Session org switching trusts the org list embedded in the signed session rather than rechecking DynamoDB membership on every request (`src/app/api/auth/org/route.ts:16`, `src/app/api/auth/org/route.ts:17`, `src/app/api/auth/org/route.ts:20`; `src/app/api/auth/session/route.ts:8`, `src/app/api/auth/session/route.ts:19`). `getAuthUser` returns a valid signed session before Cognito/Dynamo membership re-resolution (`src/lib/auth/middleware.ts:230`, `src/lib/auth/middleware.ts:233`).

Impact: stale sessions can retain access after a membership row is changed unless short session lifetimes or revocation are enforced elsewhere. Scans also increase the blast radius of future filter bugs because all tenants' rows are read before filtering.

Recommendation: make org-scoped list queries partition-bound and refresh membership for sensitive mutations or when switching orgs. Add a membership version or `revokedAt` check to session validation.

### Medium: inventory transaction is solid but has idempotency and audit gaps

The success path uses a transaction with conditional receipt creation and a conditional inventory update (`src/lib/api/dynamo-store.ts:470`, `src/lib/api/dynamo-store.ts:475`, `src/lib/api/dynamo-store.ts:476`, `src/lib/api/dynamo-store.ts:480`, `src/lib/api/dynamo-store.ts:483`, `src/lib/api/dynamo-store.ts:484`). This prevents overselling for the reserved counter.

Gaps:

- Existing receipts are returned without comparing the current request's item/quantity/user/body to the stored receipt (`src/lib/api/dynamo-store.ts:361`, `src/lib/api/dynamo-store.ts:362`, `src/lib/api/dynamo-store.ts:363`, `src/lib/api/dynamo-store.ts:368`).
- The failure-path transaction catches `TransactionCanceledException` and returns a synthetic serialization failure without re-reading the winning receipt (`src/lib/api/dynamo-store.ts:409`, `src/lib/api/dynamo-store.ts:426`, `src/lib/api/dynamo-store.ts:427`, `src/lib/api/dynamo-store.ts:429`).
- The DynamoDB path writes receipts and ledger entries but no audit event, while the in-memory non-Dynamo path pushes an `inventory_reservation` audit event (`src/lib/api/in-memory-store.ts:270`, `src/lib/api/in-memory-store.ts:275`).

Recommendation: store and compare an operation hash that excludes the idempotency key and covers `orgId`, `itemId`, `qty`, and `userId`. Return a distinct idempotency conflict if the same key is reused for a different operation. Add an audit item in the same transaction or derive audit from ledger consistently.

### Medium: user/invite model is not transactional and has global-role pressure

Admin invite flow updates or creates Cognito users, then writes a user profile row (`src/app/api/admin/users/route.ts:62`, `src/app/api/admin/users/route.ts:65`, `src/app/api/admin/users/route.ts:78`, `src/app/api/admin/users/route.ts:81`, `src/app/api/admin/users/route.ts:111`, `src/app/api/admin/users/route.ts:125`). Org setup and confirm-signup write org and admin profile as separate store calls (`src/app/api/auth/setup/route.ts:58`, `src/app/api/auth/setup/route.ts:66`, `src/app/api/auth/confirm-signup/route.ts:69`, `src/app/api/auth/confirm-signup/route.ts:70`). User profile writes are unconditional puts (`src/lib/api/dynamo-store.ts:582`, `src/lib/api/dynamo-store.ts:587`, `src/lib/api/dynamo-store.ts:589`).

Impact: partial org/profile state is possible, and re-invites/concurrent role changes can silently replace fields. Cognito `custom:role` is a single user attribute, while DynamoDB profiles can represent multiple org roles; the callback route has to recover memberships by scanning profiles by email (`src/app/api/auth/callback/route.ts:87`, `src/app/api/auth/callback/route.ts:88`).

Recommendation: separate invite receipts from membership profiles or use conditional profile writes. Use DynamoDB membership as the org-specific source of truth and avoid relying on global Cognito role attributes for authorization.

### Medium: workflow and record concurrency is optimistic only in application memory

Workflow definition save accepts the client payload version and writes the new item unconditionally (`src/app/api/workflows/[id]/definition/route.ts:33`, `src/app/api/workflows/[id]/definition/route.ts:37`, `src/app/api/workflows/[id]/definition/route.ts:65`). Publish mutates the fetched object, increments version, and writes unconditionally (`src/app/api/workflows/[id]/publish/route.ts:18`, `src/app/api/workflows/[id]/publish/route.ts:19`, `src/app/api/workflows/[id]/publish/route.ts:22`).

Record sync checks `op.base_version < existing.version`, mutates the object, increments version, and blind-writes it (`src/app/api/sync/batch/route.ts:184`, `src/app/api/sync/batch/route.ts:288`, `src/app/api/sync/batch/route.ts:299`, `src/app/api/sync/batch/route.ts:304`). This catches some stale updates when one process sees the latest item, but DynamoDB does not enforce the version at write time.

Recommendation: use conditional update/put expressions such as `version = :baseVersion` for record updates and workflow publishes. Store conflict records and mutation receipts in the same transaction when escalation is required.

### Medium: scan-based sync cursor can return unsorted and expensive results

`getServerSince` scans all mutation rows for an org where `server_seq > :seq` (`src/lib/api/dynamo-store.ts:549`, `src/lib/api/dynamo-store.ts:551`). `getCurrentSeq` scans all mutation rows and computes `Math.max` (`src/lib/api/dynamo-store.ts:557`, `src/lib/api/dynamo-store.ts:559`, `src/lib/api/dynamo-store.ts:563`). The sync route filters returned mutations again by payload org id (`src/app/api/sync/batch/route.ts:347`, `src/app/api/sync/batch/route.ts:350`, `src/app/api/sync/batch/route.ts:356`).

Impact: as mutation history grows, every sync becomes more expensive. Since scans have no ordering guarantee, clients can observe changes out of sequence even when `server_seq` values are correct.

Recommendation: query mutations by org and sequence. Sort server changes by `server_seq` before returning even after moving to a query path.

### Low: S3 attachment object scoping is by submitted ids and lacks record ownership validation

The presign route scopes keys under the authenticated user's org id (`src/app/api/attachments/presign/route.ts:102`, `src/app/api/attachments/presign/route.ts:104`) but takes `workflowId`, `recordId`, and `fieldKey` from the request body (`src/app/api/attachments/presign/route.ts:7`, `src/app/api/attachments/presign/route.ts:10`, `src/app/api/attachments/presign/route.ts:106`, `src/app/api/attachments/presign/route.ts:110`). It does not read the record/workflow from DynamoDB before signing.

Impact: a user cannot escape their org prefix, but they can mint keys for arbitrary workflow/record ids inside that org prefix. This is less severe if record attachment metadata is validated later, but the diagram's relationship between record fields and S3 evidence is stronger than the presign route enforces (`docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:33`).

Recommendation: verify workflow and record ownership before presigning, or restrict pending-record uploads to a staging prefix and move them after the record is committed.

## False or Overstated Claims

- "DynamoDB table/index access" suggests indexes are part of the live model, but no adapter code uses `IndexName` or `QueryCommand`; list paths are scans (`docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:24`, `src/lib/api/dynamo-store.ts:160`, `src/lib/api/dynamo-store.ts:165`).
- "Runtime key schema detection ... uses pk+sk or pk automatically" omits that audit event history needs a real sort key and that fallback can silently scan (`docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:4`, `src/lib/api/dynamo-store.ts:124`, `src/lib/api/dynamo-store.ts:125`).
- "Every runtime read/write carries orgId" is not true for email membership lookup, which intentionally scans users by email across orgs (`docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:27`, `src/lib/api/dynamo-store.ts:602`, `src/lib/api/dynamo-store.ts:604`).
- "Mutation -> Audit" and "Ledger -> Audit" are not implemented on the DynamoDB path (`docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:38`, `docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:40`, `src/lib/api/dynamo-store.ts:535`, `src/lib/api/dynamo-store.ts:539`, `src/lib/api/dynamo-store.ts:470`, `src/lib/api/dynamo-store.ts:495`).
- "SSE-S3 encryption" is not represented in the presigned PUT signature (`docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:21`, `src/app/api/attachments/presign/route.ts:61`, `src/app/api/attachments/presign/route.ts:124`).
- TTL on demo data is true for seed baseline and some inventory artifacts, not for all runtime-created demo mutations/conflicts/records (`docs/docs/diagrams/mermaid/03-dynamodb-access-model.mmd:43`, `src/app/api/sync/batch/route.ts:152`, `src/types/sync.ts:4`, `src/types/sync.ts:85`).

## Recommendations

1. Standardize the production table schema as `pk` HASH and `sk` RANGE. Remove hash-only production guidance or make it a documented legacy migration mode.
2. Replace scan-heavy list/cursor/email reads with `QueryCommand` access paths and explicit GSIs. Treat scans as admin/debug only.
3. Make sync atomic: conditional mutation receipt, durable sequence allocation, record/workflow write, conflict write, and audit write should not be separable for one operation.
4. Await all DynamoDB writes in the facade. `putRecordForOrg` should behave like `putWorkflowForOrg`, `putUserProfileAsync`, and `putInventoryItemForOrg`, which await the backing store (`src/lib/api/in-memory-store.ts:80`, `src/lib/api/in-memory-store.ts:81`, `src/lib/api/in-memory-store.ts:132`, `src/lib/api/in-memory-store.ts:133`, `src/lib/api/in-memory-store.ts:213`, `src/lib/api/in-memory-store.ts:214`).
5. Add conditional writes for optimistic concurrency: records by `version`, workflows by `version`, user profiles by membership version/status, inventory item admin updates by version.
6. Stamp demo `expiresAt` in one shared write layer for any org id that belongs to a demo install. Add TTL enablement verification and application-level expired-demo filtering because DynamoDB TTL deletion is asynchronous.
7. Fix inventory idempotency semantics by validating same key plus same operation content. Add audit emission for DynamoDB inventory reservations or document ledger as the audit source.
8. Separate invites from user profiles or use conditional membership writes. Add an email membership GSI to remove login/invite scans.
9. Verify S3 attachment record/workflow ownership before presigning and sign required SSE headers if SSE-S3 is a product/security claim.
10. Add tests that exercise the real DynamoDB adapter with a `pk/sk` local table: concurrent duplicate sync operations, concurrent record updates, concurrent workflow publish, audit multiple events for one record, inventory idempotency key reuse with different payloads, and demo TTL propagation for post-seed writes.
