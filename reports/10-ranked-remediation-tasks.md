# Ranked Remediation Task Plan

Date: 2026-06-30

This task plan ranks work by dependency. Items earlier in the list unblock or reduce risk for later items.

## P0 - Trust Boundary and Data Isolation

### T01 - Make auth token verification fail closed

Status: Done on `audit` - fail-closed JWT verification, verified Google callback setup flow, and production session-secret requirement are patched. Vercel production and preview now have `SESSION_SECRET`.

Why first: every API route depends on `getAuthUser()` being trustworthy.

Tasks:
- Reject Cognito JWTs unless `alg === "RS256"` and `kid` exists.
- Reject JWTs when JWKS cannot be fetched or no matching key exists.
- Do not trust decoded OAuth payloads unless token verification succeeded.
- Require a strong `SESSION_SECRET` in production.

Primary files:
- `src/lib/auth/middleware.ts`
- `middleware.ts`
- `src/app/api/auth/callback/route.ts`

### T02 - Purge offline artifacts on logout

Status: Done on `audit` - client logout now clears app IndexedDB stores, FieldFlow local/session storage except language preference, and identity-scoped page caches after server cookies are cleared.

Why second: offline auth currently survives logout/revocation in browser-local state.

Tasks:
- Clear Zustand auth state.
- Clear `fieldflow-pages` cache.
- Clear demo localStorage keys.
- Add a safe IndexedDB purge or per-user/org namespace cleanup.

Primary files:
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Drawer.tsx`
- `src/components/layout/MobileAccountMenu.tsx`
- `src/stores/authStore.ts`
- `src/lib/db/indexeddb.ts`

### T03 - Scope IndexedDB workflow/record access by org

Status: Done on `audit` - local workflow and record primary keys are now workspace-scoped internally while public IDs remain unchanged. Supervisor/record/conflict offline fallbacks now use current org scope.

Why third: offline correctness depends on local data matching the current org.

Tasks:
- Prevent workflow id collisions across orgs.
- Prevent supervisor/admin offline fallbacks from reading all local records.
- Add migration-safe local key helpers or composite storage keys.

Primary files:
- `src/lib/db/indexeddb.ts`
- `src/lib/demo/offline-demo-cache.ts`
- `src/app/(routes)/supervisor/dashboard/page.tsx`
- `src/app/(routes)/field-worker/record/[id]/page.tsx`

## P1 - Sync Correctness

### T04 - Separate failed sync attempts from successful syncs

Status: Done on `audit` - sync now tracks attempt time, successful sync time, and last error separately. Failed runs no longer update the successful sync timestamp.

Tasks:
- Track `lastAttemptAt`, `lastSuccessfulSyncAt`, and `lastError`.
- Do not update `lastSyncAt` on catch as if sync succeeded.
- Surface failed transport state in status UI.

Primary files:
- `src/lib/sync/run-background-sync.ts`
- `src/stores/syncStore.ts`
- `src/app/(routes)/field-worker/status/page.tsx`

### T05 - Drain more than 100 mutations

Status: Pending

Tasks:
- Loop batches until no pending mutations remain or a safety limit is reached.
- Keep `pending_count` accurate.

Primary files:
- `src/lib/sync/sync-client.ts`
- `src/lib/db/indexeddb.ts`

### T06 - Make conflict resolution durable offline

Status: Pending

Tasks:
- Enqueue conflict-resolution mutations when offline.
- Sync conflict resolutions through the same protocol as online resolution.
- Refresh local conflict queues after resolution.

Primary files:
- `src/app/(routes)/field-worker/conflicts/page.tsx`
- `src/app/(routes)/supervisor/conflicts/page.tsx`
- `src/app/api/sync/conflict/route.ts`
- `src/types/sync.ts`

### T07 - Make mutation idempotency atomic

Status: Pending

Tasks:
- Replace check-then-write idempotency with conditional receipt creation.
- Allocate server sequence durably per org.
- Sort cursor responses by sequence.

Primary files:
- `src/app/api/sync/batch/route.ts`
- `src/lib/api/dynamo-store.ts`
- `src/lib/api/in-memory-store.ts`

## P2 - Membership and Invitation Model

### T08 - Stop using global Cognito role for org authorization

Status: Pending

Tasks:
- Prefer signed session membership role over Cognito `custom:role`.
- Revalidate active membership for sensitive mutations.
- Avoid mutating Cognito `custom:role` on org invite.

Primary files:
- `src/lib/auth/middleware.ts`
- `src/lib/auth/workspace-membership.ts`
- `src/app/api/admin/users/route.ts`

### T09 - Add real invite acceptance or first-login handling

Status: Pending

Tasks:
- Support Cognito `NEW_PASSWORD_REQUIRED`, or move to self-signup plus pending invitation claim.
- Add invitation rows with token/expiry/status.
- Do not mark invitee active until acceptance.

Primary files:
- `src/app/api/admin/users/route.ts`
- `src/app/api/auth/login/route.ts`
- new invite acceptance route

## P3 - Workflow and Record Semantics

### T10 - Validate workflow definitions server-side

Status: Pending

Tasks:
- Validate fields, state graph, transitions, roles, labels, and offline policy before save/publish.
- Return structured validation errors.

Primary files:
- `src/app/api/workflows/[id]/definition/route.ts`
- `src/app/api/workflows/[id]/publish/route.ts`
- `src/lib/ai/validator/validate.ts`

### T11 - Make publish versioned and non-misleading

Status: Pending

Tasks:
- Stop marking publish successful when backend fails.
- Use server response as authoritative.
- Add conditional version writes.
- Store immutable published snapshots or change copy to match current behavior.

Primary files:
- `src/stores/workflowStore.ts`
- `src/app/(routes)/admin/workflows/[id]/page.tsx`
- `src/app/api/workflows/[id]/publish/route.ts`

### T12 - Validate record state transitions before mutation

Status: Pending

Tasks:
- Validate create/update status and state before mutating existing records.
- Clone records before mutation.
- Reject illegal direct state jumps.

Primary files:
- `src/app/api/sync/batch/route.ts`
- `src/lib/workflows/runtime.ts`

### T13 - Add list invalidation after workflow/sync/review/conflict actions

Status: Pending

Tasks:
- Refresh workflow lists after save/publish.
- Refresh review/home/search/conflict lists after sync or mutation success.
- Add shared invalidation signal if needed.

Primary files:
- `src/stores/workflowListStore.ts`
- `src/hooks/useWorkflowContext.ts`
- dashboard/review/search/conflict pages

## P4 - Critical Inventory

### T14 - Enforce inventory role checks at API level

Status: Pending

Tasks:
- Require supervisor-or-admin role for inventory list/reserve APIs.

Primary files:
- `src/app/api/critical/inventory/route.ts`
- `src/app/api/critical/inventory/reserve/route.ts`
- `src/lib/auth/roles.ts`

### T15 - Validate inventory receipt content hash

Status: Pending

Tasks:
- Compare existing receipt content hash with incoming command.
- Return idempotency mismatch for same key/different operation.

Primary files:
- `src/lib/api/dynamo-store.ts`

### T16 - Couple reserved workflow transition to inventory transaction

Status: Pending

Tasks:
- Make reservation a server command tied to record transition.
- Update record state, stock, receipt, and ledger atomically.

Primary files:
- `src/app/api/sync/batch/route.ts`
- `src/app/api/critical/inventory/reserve/route.ts`
- `src/lib/api/dynamo-store.ts`

## P5 - DynamoDB Access Model and TTL

### T17 - Await DynamoDB record writes

Status: Pending

Tasks:
- Make `putRecordForOrg` wait for DynamoDB like other store writes.

Primary files:
- `src/lib/api/in-memory-store.ts`

### T18 - Standardize production table schema

Status: Pending

Tasks:
- Require `pk` HASH and `sk` RANGE for production.
- Stop silently scanning around schema mismatch in production.
- Update README/env docs.

Primary files:
- `src/lib/api/dynamo-store.ts`
- `.env.example`
- `README.md`

### T19 - Add queryable access paths

Status: Pending

Tasks:
- Replace normal scans with key queries/GSIs.
- Add email membership, org entity lists, mutation cursor, conflict queue access paths.

Primary files:
- `src/lib/api/dynamo-store.ts`

### T20 - Stamp demo expiry on all demo-scoped writes

Status: Pending

Tasks:
- Resolve demo org expiry.
- Apply `expiresAt` to sync-created records, mutations, conflicts, and audits.
- Decide whether reopened installs extend TTL.

Primary files:
- `src/app/api/sync/batch/route.ts`
- `src/app/api/sync/conflict/route.ts`
- `src/lib/demo/seed-demo-org.ts`
- `src/lib/api/dynamo-store.ts`

## Clean Todo

- [ ] T01: Make auth token verification fail closed.
- [x] T02: Purge offline artifacts on logout.
- [x] T03: Scope IndexedDB workflow/record access by org.
- [x] T04: Separate failed sync attempts from successful syncs.
- [ ] T05: Drain more than 100 mutations.
- [ ] T06: Make conflict resolution durable offline.
- [ ] T07: Make mutation idempotency atomic.
- [ ] T08: Stop using global Cognito role for org authorization.
- [ ] T09: Add real invite acceptance or first-login handling.
- [ ] T10: Validate workflow definitions server-side.
- [ ] T11: Make publish versioned and non-misleading.
- [ ] T12: Validate record state transitions before mutation.
- [ ] T13: Add list invalidation after workflow/sync/review/conflict actions.
- [ ] T14: Enforce inventory role checks at API level.
- [ ] T15: Validate inventory receipt content hash.
- [ ] T16: Couple reserved workflow transition to inventory transaction.
- [ ] T17: Await DynamoDB record writes.
- [ ] T18: Standardize production table schema.
- [ ] T19: Add queryable access paths.
- [ ] T20: Stamp demo expiry on all demo-scoped writes.
