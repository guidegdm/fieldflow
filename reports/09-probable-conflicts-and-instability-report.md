# Probable Conflicts and Cross-System Instability Report

Date: 2026-06-30

This report synthesizes the eight independent audits in `reports/01-*` through `reports/08-*`. It focuses on conflicts that are likely to happen across flows, not only isolated bugs inside one page.

## Executive Summary

FieldFlow has the right product shape, but several subsystems currently assume a single writer, a fresh browser session, and a stable online request. Those assumptions conflict with the product promise: multi-role teams, offline-first usage, demo sandboxing, conflict-aware sync, and critical inventory.

The highest-risk conflicts are:

1. **Identity and authorization can drift between Cognito, signed session cookies, DynamoDB membership rows, and offline Zustand state.**
2. **Local IndexedDB keys are not org-scoped, while demo/live workflows can share ids such as `wf-1`.**
3. **Sync idempotency is check-then-write and sequence ordering is process-local, so duplicate or concurrent requests can apply twice or be ordered incorrectly.**
4. **Workflow publish claims immutability, but the implementation mutates the same workflow item and allows stale clients to overwrite state.**
5. **Inventory reservations are transactionally safe only inside the standalone inventory endpoint; workflow record transitions can claim reserved states without stock reservation.**
6. **Demo TTL is attached to seed data, but not to all data created after the sandbox starts.**

## Probable Conflict Scenarios

### 1. User Role Conflict Across Orgs

An existing user can be invited to multiple workspaces with different roles. The membership resolver returns per-org profiles, but Cognito still has a global `custom:role`, and API auth can prefer the access-token role over the signed org context.

Probable result: a user can appear as the correct role in one UI path while API routes authorize them using a stale or global role.

Relevant reports:
- `01-org-invite-membership-report.md`
- `02-auth-journey-offline-report.md`
- `08-dynamodb-access-model-report.md`

Root fixes:
- Make DynamoDB membership the source of truth for org role.
- Revalidate active membership on sensitive API mutations.
- Stop relying on global Cognito role attributes for org authorization.

### 2. Offline Session Conflict After Logout or Revocation

The frontend persists auth state, IndexedDB data, and cached pages. Logout clears cookies, but does not clear IndexedDB/cache artifacts. Existing sessions also do not re-check membership activity.

Probable result: a browser that was once authenticated can keep seeing offline pages/data after logout, membership revocation, or session expiry.

Relevant reports:
- `02-auth-journey-offline-report.md`
- `01-org-invite-membership-report.md`
- `06-demo-isolation-ttl-report.md`

Root fixes:
- Purge local auth/cache/IndexedDB on logout.
- Add session expiry awareness to persisted client auth.
- Revalidate membership for sensitive online requests.

### 3. Cross-Org IndexedDB Overwrite

IndexedDB stores `workflows` by raw `id`, while demo orgs reuse ids like `wf-1`, `wf-community-intake`, and `wf-stock-check`. Hydrating all workspaces can overwrite workflow definitions across orgs.

Probable result: a user switches org or goes offline and sees records from one org rendered against the workflow definition from another org.

Relevant reports:
- `01-org-invite-membership-report.md`
- `06-demo-isolation-ttl-report.md`
- `08-dynamodb-access-model-report.md`

Root fixes:
- Scope local workflow and record keys by org, or add a migration-safe composite key layer.
- Filter every offline fallback by current `orgId`.

### 4. Duplicate Sync Application

The sync route checks for an existing mutation, applies record/workflow changes, then stores the mutation. DynamoDB mutation writes are unconditional, and sequence numbers are process-local.

Probable result: duplicate client retries or concurrent requests can apply the same logical operation twice, return duplicate/non-monotonic server sequence numbers, or clear pending counts while work remains.

Relevant reports:
- `03-offline-sync-protocol-report.md`
- `08-dynamodb-access-model-report.md`
- `05-workflow-record-review-conflict-report.md`

Root fixes:
- Write mutation receipt conditionally before side effects.
- Use durable per-org sequence allocation or queryable cursor keys.
- Drain sync queues in loops beyond 100 mutations.

### 5. Failed Sync Presented as Healthy

`performSync()` updates `lastSyncAt` even when sync fails. Transport failures do not increment mutation retry state. The status UI can therefore show a recent sync while local mutations remain dirty.

Probable result: field workers believe work was synchronized when it was not.

Relevant report:
- `03-offline-sync-protocol-report.md`

Root fixes:
- Track `lastAttemptAt`, `lastSuccessfulSyncAt`, and `lastSyncError` separately.
- Mark failed transport attempts without claiming success.

### 6. Workflow Publish/Edit Race

The builder saves and publishes optimistically. The server overwrites workflow definitions without immutable snapshots or version conditions. Published workflows can still be edited in place.

Probable result: two admins can overwrite each other's workflow edits, field devices can run different definitions under the same workflow id/version, and UI can show "published" after backend failure.

Relevant reports:
- `04-workflow-compiler-publication-report.md`
- `05-workflow-record-review-conflict-report.md`
- `08-dynamodb-access-model-report.md`

Root fixes:
- Add server-side validation before save/publish.
- Use version conditional writes.
- Store immutable published workflow versions separately from drafts.

### 7. Record State vs Inventory State Divergence

The workflow definition contains `sideEffects: ["inventory_reserve"]`, but the sync/review flow does not execute inventory reservation when a record moves to reserved state.

Probable result: records can say aid was reserved while inventory stock was never decremented, or stock can be reserved without a linked household record.

Relevant reports:
- `07-critical-inventory-transaction-report.md`
- `05-workflow-record-review-conflict-report.md`

Root fixes:
- Move reservation behind a server-side record transition command.
- Transactionally update record state, inventory receipt, stock count, and ledger.

### 8. Inventory Retry Duplication

The inventory UI generates a new idempotency key on every click. If the server commits but the browser times out, retrying generates a new key and can reserve twice.

Probable result: critical inventory is protected against simultaneous clicks with the same key, but not against unknown network outcomes followed by manual retry.

Relevant report:
- `07-critical-inventory-transaction-report.md`

Root fixes:
- Persist a reservation command locally before POST.
- Reuse the same idempotency key until terminal receipt.
- Validate receipt content hash on replay.

### 9. Demo Cleanup Drift

Seeded demo data receives `expiresAt`, but sync-created records, mutations, conflicts, and some audit events do not consistently inherit sandbox expiry. Reopening an install can refresh some TTLs while leaving older records/inventory on previous TTLs.

Probable result: demo orgs can partially disappear or leave orphaned runtime data after TTL cleanup.

Relevant reports:
- `06-demo-isolation-ttl-report.md`
- `08-dynamodb-access-model-report.md`

Root fixes:
- Resolve demo expiry per org and stamp all demo-scoped writes.
- Decide whether reopening a sandbox extends TTL; if yes, refresh all entity TTLs.

### 10. Scan-Based DynamoDB Access Under Load

The access model mostly uses table scans for list, membership, and cursor reads. This conflicts with the single-table/index diagram and with a scalable production claim.

Probable result: login, dashboards, sync, and conflict queues become slow/costly as data grows; throttling can appear as functional bugs.

Relevant report:
- `08-dynamodb-access-model-report.md`

Root fixes:
- Standardize `pk` + `sk` table schema.
- Add queryable GSIs for org entity lists, user email memberships, sync sequence, and conflict queues.

## Immediate Engineering Posture

Do not start by polishing pages. Fix the foundation in this order:

1. Fail-closed auth and real signing secret.
2. Local data isolation by org.
3. Sync success/failure truthfulness and queue draining.
4. Atomic idempotency/sequence model.
5. Workflow publish/version correctness.
6. Inventory transition coupling.

