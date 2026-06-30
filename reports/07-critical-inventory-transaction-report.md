# Critical Inventory Transaction Audit

Date: 2026-06-30

Scope: `docs/docs/diagrams/mermaid/08-critical-inventory-transaction.mmd`, inventory list/reserve APIs, DynamoDB transaction logic, idempotency, UI behavior, offline behavior, sync/conflict interaction, race/concurrency risks, and public claims.

## Executive Verdict

The DynamoDB success path mostly implements the diagram's core stock reservation transaction: receipt put, conditional stock update, and ledger put happen in one `TransactWriteCommand` with a stock guard. That protects the inventory API from two concurrent successful reservations of the last unit under the current item total.

The product guarantee is still overstated. The UI does not preserve idempotency keys across unknown network outcomes, workflow transitions can move records into a reserved state without reserving inventory, inventory reservations are not part of the offline sync protocol, idempotency receipts do not validate request-content reuse, and several failure/race branches either do not persist receipts or hide infrastructure errors as serialization failures.

## Diagram Conformance

The diagram says the request contains `item_id`, `quantity`, and `idempotency_key`; the route schema accepts exactly those fields at `src/app/api/critical/inventory/reserve/route.ts:6-10` and calls the store at `src/app/api/critical/inventory/reserve/route.ts:23-24`.

The diagram says the API authenticates and resolves `orgId` from cookies at `docs/docs/diagrams/mermaid/08-critical-inventory-transaction.mmd:3`. The route only checks `getAuthUser` at `src/app/api/critical/inventory/reserve/route.ts:13-14`, and `getAuthUser` resolves signed/session/cognito cookies plus optional `x-fieldflow-org-id` at `src/lib/auth/middleware.ts:215-254`.

The diagram's content hash is implemented in the DynamoDB store as `orgId|itemId|qty|userId|idempotencyKey` at `src/lib/api/dynamo-store.ts:361`, matching `docs/docs/diagrams/mermaid/08-critical-inventory-transaction.mmd:4`.

The receipt check and replay exist at `src/lib/api/dynamo-store.ts:362-370`, matching `docs/docs/diagrams/mermaid/08-critical-inventory-transaction.mmd:5-6`.

The success transaction matches the diagram's structure: receipt put with `attribute_not_exists(pk)` at `src/lib/api/dynamo-store.ts:473-477`, inventory update at `src/lib/api/dynamo-store.ts:480-490`, and committed ledger put at `src/lib/api/dynamo-store.ts:492-496`, corresponding to `docs/docs/diagrams/mermaid/08-critical-inventory-transaction.mmd:13-21`.

The failure path only partly matches. The pre-read insufficient-stock branch writes a failure receipt and failed ledger at `src/lib/api/dynamo-store.ts:378-425`, corresponding to `docs/docs/diagrams/mermaid/08-critical-inventory-transaction.mmd:10-11`. However, if that failure transaction is canceled, the code swallows `TransactionCanceledException` at `src/lib/api/dynamo-store.ts:426-428` and still returns a failure at `src/lib/api/dynamo-store.ts:429-436` without replaying the receipt. Commit-race failures also return `SERIALIZATION_FAILURE` after reading latest stock at `src/lib/api/dynamo-store.ts:502-523`, but they do not write a failure receipt or failed ledger.

## API And Data Flow

Inventory list:

- `GET /api/critical/inventory` requires authentication at `src/app/api/critical/inventory/route.ts:5-7`.
- It lists items scoped by `user.orgId` at `src/app/api/critical/inventory/route.ts:9`.
- It returns `itemId`, `label`, `total`, and computed `available`, but not `reserved`, `updatedAt`, version, or a stock snapshot token at `src/app/api/critical/inventory/route.ts:10-15`.

Reservation:

- The route accepts `item_id`, `idempotency_key`, and integer `quantity` from 1 to 100 at `src/app/api/critical/inventory/reserve/route.ts:6-10`.
- It does not enforce a supervisor/admin role in the API; it only requires an authenticated user at `src/app/api/critical/inventory/reserve/route.ts:13-14`.
- It maps all non-success results except `ITEM_NOT_FOUND` to HTTP 409 at `src/app/api/critical/inventory/reserve/route.ts:26-28`.

Store selection:

- DynamoDB is enabled by default because `DYNAMODB_ENABLED` is `process.env.DYNAMODB_ENABLED !== "false"` at `src/lib/api/in-memory-store.ts:7`.
- `reserveInventoryForOrg` delegates to DynamoDB when enabled at `src/lib/api/in-memory-store.ts:282-291`.
- If DynamoDB import/use fails, the reserve result becomes `DYNAMO_UNAVAILABLE` at `src/lib/api/in-memory-store.ts:287-291`, which the route still returns as HTTP 409.

## Findings

### Critical: Workflow "reserved" State Is Not Coupled To Inventory Reservation

The demo workflow declares a reserve transition with `sideEffects: ["inventory_reserve"]` at `src/lib/demo/seed-demo-org.ts:62-68`, and the workflow type supports `sideEffects` at `src/types/workflow.ts:58-67`. The supervisor review screen sends only a record update mutation to `/api/sync/batch` at `src/app/(routes)/supervisor/review/page.tsx:118-150`. The sync API validates state transitions at `src/app/api/sync/batch/route.ts:289-297`, but it never executes transition side effects or calls `reserveInventoryForOrg`.

Impact: records can enter `s-reserved` without decrementing stock or writing an inventory receipt/ledger. Conversely, `/supervisor/inventory` can reserve generic stock without linking the reservation to a household/record. This is the largest gap between the diagram and actual business correctness.

Recommendation: make reservation a server-side command tied to a record transition. In one DynamoDB transaction, conditionally update the record state/version, update inventory stock, put the idempotency receipt, and put the ledger entry. The idempotency key should be derived from a durable command ID such as `recordId + transitionId + client_id`.

### High: Client Idempotency Does Not Survive Unknown Network Outcomes

The supervisor inventory UI generates a fresh key inside each click handler at `src/app/(routes)/supervisor/inventory/page.tsx:53-61`. `apiPost` times out after 15 seconds at `src/lib/api/client.ts:1-7` and throws on any non-OK response at `src/lib/api/client.ts:28-31`. If the server commits but the browser times out or loses the response, the UI shows failure at `src/app/(routes)/supervisor/inventory/page.tsx:69-70`; a manual retry generates a new key and can create a second reservation.

Impact: the public claim that bad-network retries do not duplicate the business action is only true when the exact same idempotency key is reused. The current UI does not do that for manual retries after unknown outcomes.

Recommendation: create and persist a reservation command object before POST. Keep the same `idempotency_key` until the server returns a terminal receipt. On timeout, show an "unknown, retry" state that resubmits the same key.

### High: Existing Receipts Are Replayed Without Content-Hash Validation

The DynamoDB store computes a content hash at `src/lib/api/dynamo-store.ts:361` and stores it in receipts at `src/lib/api/dynamo-store.ts:455-466`, but the existing receipt branch only checks that a receipt exists and returns its outcome at `src/lib/api/dynamo-store.ts:362-370`. It does not compare the stored `contentHash`, `itemId`, `quantity`, or `userId` to the incoming request.

Impact: accidental or malicious reuse of an idempotency key for a different request in the same org replays the old result instead of returning an idempotency-key mismatch. The content hash is currently audit metadata, not an enforcement mechanism.

Recommendation: on receipt replay, compare stored request identity to the newly computed hash. Return HTTP 409 `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_CONTENT` if it differs.

### High: Race And Failure Branches Are Not Fully Idempotent

The pre-read insufficient-stock branch writes a failure receipt and failed ledger at `src/lib/api/dynamo-store.ts:378-425`, but it swallows transaction cancellation at `src/lib/api/dynamo-store.ts:426-428` and returns a synthetic failure at `src/lib/api/dynamo-store.ts:429-436`. The success transaction catch reads a receipt and replays it when present at `src/lib/api/dynamo-store.ts:502-512`; if no receipt exists, it returns `SERIALIZATION_FAILURE` with latest stock at `src/lib/api/dynamo-store.ts:514-523` without storing a failure receipt or ledger.

Impact: not every terminal-looking failure has a durable receipt. Retrying the same key after a stock race may recompute the command instead of replaying a stored failure, especially if stock later changes.

Recommendation: define which failures are terminal and receipt-backed. If the API returns a final 409, write a failure receipt. If a failure is retryable and not receipt-backed, return a distinct status such as `CONFLICT_RETRY_REQUIRED` and avoid implying a stored outcome.

### Medium: API Role Authorization Is Enforced In UI, Not At The Critical Endpoint

The supervisor layout uses `useRequireSession(["supervisor"])` at `src/app/(routes)/supervisor/layout.tsx:7-13`, and role ranking allows org admins to satisfy supervisor access at `src/lib/auth/roles.ts:3-20`. The inventory reserve API itself only checks authentication at `src/app/api/critical/inventory/reserve/route.ts:13-14`. A field worker with a valid session could call the API directly if they know the endpoint and item ID.

Recommendation: enforce `hasAnyRoleAccess(user.role, ["supervisor"])` or a specific permission in both `GET /api/critical/inventory` and `POST /api/critical/inventory/reserve`.

### Medium: Inventory Is Not Part Of Offline Sync Or Conflict Resolution

The sync mutation type allows only `create`, `update`, `delete`, `attach_evidence`, and `workflow_definition` at `src/types/sync.ts:1-12`; the sync batch route enforces the same enum at `src/app/api/sync/batch/route.ts:11-26`. IndexedDB stores mutations, records, workflows, attachments, device state, and conflicts at `src/lib/db/indexeddb.ts:7-14`, but has no inventory receipt/command store. Background sync pushes pending record mutations through `fullSync` at `src/lib/sync/run-background-sync.ts:30-58` and `src/lib/sync/sync-client.ts:68-108`.

Impact: inventory reservations are online-only direct POSTs, while record transitions and conflict resolution flow through sync records. The two systems can diverge under offline use and conflict resolution.

Recommendation: either explicitly keep reserve transitions online-only and block them offline, or add inventory reservation commands to the sync protocol with server-side serialization and receipt replay.

### Medium: Offline UI Shows Cached Stock But Cannot Reserve

Offline warmup caches the supervisor inventory route at `src/components/OfflineWarmup.tsx:21-44` and warms inventory JSON into `localStorage` at `src/components/OfflineWarmup.tsx:190-208`. The service worker only handles GET HTML requests at `worker/index.js:27-33`; it ignores non-GET requests at `worker/index.js:27-30`. The inventory page falls back to cached localStorage items on load failure at `src/app/(routes)/supervisor/inventory/page.tsx:28-51`, but the reserve button still calls the live POST at `src/app/(routes)/supervisor/inventory/page.tsx:53-74`.

Impact: offline users can see stale stock and click reserve, but the action fails rather than queueing or clearly presenting an online-only state.

Recommendation: detect offline mode on the inventory page. Disable reserve with an online-required message, or queue a durable reservation command with the same conflict rules as the server.

### Medium: UI Ignores Server `remaining` And Applies A Local Decrement

After a successful reserve response, the UI subtracts one from its local `available` value at `src/app/(routes)/supervisor/inventory/page.tsx:63-65`. The API can return `remaining` from the DynamoDB store at `src/lib/api/dynamo-store.ts:501`, but the UI response type only models `success` and `error` at `src/app/(routes)/supervisor/inventory/page.tsx:58`.

Impact: if the local list is stale or multiple tabs/supervisors reserve concurrently, the displayed stock can remain wrong after a successful server transaction.

Recommendation: include `remaining`, `contentHash`, and possibly `receiptId` in the response type and update the specific item from `remaining`, then refetch the list after success.

### Medium: Stock Condition Uses A Pre-Read Total

The success transaction computes `available` from a prior read at `src/lib/api/dynamo-store.ts:373-377` and later uses `:reservedLimit` equal to `item.total - qty` in the condition at `src/lib/api/dynamo-store.ts:484-489`. This correctly blocks concurrent increments against the same observed total, but it does not assert that `total` itself is still the same item total.

Impact: if future admin/import code changes `total` concurrently with reservations, the condition may not protect against a changed total unless those writers also coordinate.

Recommendation: add a stock version or `total = :observedTotal` condition, and require all stock adjustments to use transactions with the same version discipline.

### Medium: Infrastructure Errors Are Reported As Serialization Failures

The success transaction catches all errors at `src/lib/api/dynamo-store.ts:502-523`. If no receipt exists, the code returns `SERIALIZATION_FAILURE` even for non-transaction infrastructure errors, validation errors, throttling, or IAM/config problems. The route maps that to HTTP 409 at `src/app/api/critical/inventory/reserve/route.ts:26-28`.

Impact: operational failures can be misclassified as business contention. That can mislead the UI, support, and judges evaluating the critical path.

Recommendation: inspect error names and DynamoDB transaction cancellation reasons. Return 409 only for stock/condition races; return 503/500 for infrastructure failures.

### Low: In-Memory Fallback Has Different Idempotency Semantics

The in-memory fallback hashes `itemId|qty|userId` without `orgId` or `idempotencyKey` at `src/lib/api/in-memory-store.ts:218-222`, stores idempotency keys in a global `criticalOps` map at `src/lib/api/in-memory-store.ts:28` and `src/lib/api/in-memory-store.ts:223-227`, and locks by `itemId` only at `src/lib/api/in-memory-store.ts:250-279`.

Impact: if `DYNAMODB_ENABLED=false`, idempotency and locking are not org-scoped and do not match the diagram. This may be acceptable for local demo mode, but it should not be described as the production-critical implementation.

Recommendation: either document this as a non-production fallback or align the fallback with org-scoped receipt semantics.

## False Or Overstated Claims

The diagram is accurate for the DynamoDB success transaction, but incomplete for actual business correctness because it omits record workflow side effects, role authorization, client retry-key persistence, and sync/offline behavior.

The UI copy says "two supervisors cannot allocate the same item at the same time" at `src/lib/i18n/en.json:230-231`. That is true for successful direct inventory API reservations under a stable item total, but false if "allocate" includes moving workflow records to `s-reserved`, because that transition does not call the inventory reserve API.

The video script says bad-network retries will not duplicate the business action at `video-script.md:140-142`. The backend can replay a stable idempotency key, but the current UI generates a new key per click at `src/app/(routes)/supervisor/inventory/page.tsx:53-61`, so manual retry after an unknown network outcome can duplicate the reservation.

The engineering ledger view is real but partial: it reads ledger entries from the store at `src/app/api/engineering/snapshot/route.ts:10-15` and maps them at `src/app/api/engineering/snapshot/route.ts:35-43`, but race failures from the success-transaction catch do not create failed ledger rows at `src/lib/api/dynamo-store.ts:502-523`.

## Recommended Test Coverage

Add integration tests for:

1. Two concurrent reservations against one remaining unit: one success, one 409, final reserved count increments once, and ledger/receipt state is expected.
2. Same idempotency key and same body retried after success: response replays and stock is not incremented.
3. Same idempotency key with different item or quantity: response is an idempotency mismatch and stock is unchanged.
4. Simulated timeout after server commit: client retry reuses the same key.
5. Workflow transition to `s-reserved`: record and inventory update atomically, or the transition is blocked.
6. Offline inventory page: reserve is disabled or queued intentionally.
7. DynamoDB transaction infrastructure failure: API returns operational error, not `SERIALIZATION_FAILURE`.

## Priority Fix Plan

1. Move inventory reservation behind a server-side record transition command and wire `sideEffects: ["inventory_reserve"]`.
2. Persist client reservation command IDs and reuse idempotency keys across retries.
3. Enforce content-hash validation on receipt replay.
4. Make every final 409 either receipt-backed or explicitly retryable without claiming stored outcome.
5. Add API role authorization.
6. Update UI to use server `remaining`, show offline-online state clearly, and refetch after success.
7. Narrow public claims until the workflow, offline, and retry gaps are closed.
