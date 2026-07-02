# FieldFlow Remediation Plan

Date: 2026-07-02

This plan ranks the current reliability work by dependency order. It is based on the fresh local-first, sync-engine, native-shell, and workflow audits in `reports/10-*` through `reports/13-*`.

## 1. Make server mutation commits atomic

Fix first because every local-first improvement depends on retries being safe.

- Problem: `/api/sync/batch` can acknowledge a mutation after a claim write but before the record/conflict/checkpoint write is fully committed.
- Impact: a retry can silently skip work and cause data loss.
- Target files: `src/app/api/sync/batch/route.ts`, `src/lib/api/dynamo-store.ts`, `src/lib/api/in-memory-store.ts`.
- Required change: commit mutation claim, record update, conflict creation, mutation completion, and checkpoint movement with a single committed/failed state. In DynamoDB this should use `TransactWriteItems` where possible; otherwise use explicit `status=claimed|committed|failed` and never auto-ack claimed-only rows.

## 2. Make conflict resolution idempotent

Fix before changing review flows because conflict closure must survive duplicate submits and reconnect retries.

- Problem: `/api/sync/conflict` creates a new synthetic client id on each retry and writes conflict, record, and mutation rows separately.
- Impact: duplicate retries can bump versions and close conflicts more than once.
- Target files: `src/app/api/sync/conflict/route.ts`, `src/lib/sync/offline-conflict-resolution.ts`.
- Required change: require or derive a stable resolution idempotency key and commit the conflict row, record projection, and resolution marker together.

## 3. Introduce one device pipeline coordinator

Fix before broad UI rewrites so all triggers feed the same sync/update loop.

- Problem: online/focus/service-worker/manual-save/update flows all trigger separate sync paths.
- Impact: duplicate work, noisy prompts, racey pending counts, and unreliable background sync when no page is open.
- Target files: `src/hooks/useNetworkStatus.ts`, `src/components/ServiceWorkerRegister.tsx`, `src/components/AppUpdateManager.tsx`, `src/lib/sync/run-background-sync.ts`.
- Required change: one cross-tab coordinator with a lock, ordered jobs, backoff retries, visible state, and version-aware app-shell refresh.

## 4. Route every operational write through the local outbox

Fix after the server can retry safely.

- Problem: workflow publish/archive, supervisor review, and inventory reserve still call cloud APIs directly.
- Impact: these actions fail or become ambiguous in weak/offline networks.
- Target files: `src/app/(routes)/admin/workflows/[id]/page.tsx`, `src/stores/workflowStore.ts`, `src/app/(routes)/supervisor/review/page.tsx`, `src/app/(routes)/supervisor/inventory/page.tsx`.
- Required change: enqueue local commands first, update local projections optimistically, then let the coordinator push to cloud and reconcile.

## 5. Add durable IndexedDB projections for every role surface

Fix after write routing so reads and writes use the same local model.

- Problem: admin dashboard/users and supervisor inventory/dashboard are still cloud-first or `localStorage` cached.
- Impact: offline state is inconsistent by role and page.
- Target files: `src/lib/db/indexeddb.ts`, admin pages, supervisor pages, workflow stores.
- Required change: IndexedDB projections for workspace users, workflow summaries, inventory ledgers, dashboard stats, and review queues.

## 6. Make workflow transitions explicit business state

Fix before building more complex workflows.

- Problem: review actions infer behavior from labels such as approve/reject/verify.
- Impact: translations or renamed states can change business logic.
- Target files: `src/app/(routes)/supervisor/review/page.tsx`, workflow schema/types, workflow builder.
- Required change: transitions should carry explicit `kind`, `from`, `to`, `allowedRoles`, `requiresReason`, and `terminal` metadata. Review pages should mutate records by transition id, not label text.

## 7. Version page/warmup caches

Fix after coordinator work, then tune performance.

- Problem: page and warmup caches are durable but not tied to app build/schema version.
- Impact: stale server-component payloads and app shell assets can survive deploys and show raw JSON/black screens offline.
- Target files: `worker/index.js`, `next.config.ts`, `src/components/OfflineWarmup.tsx`, `src/components/AppUpdateManager.tsx`.
- Required change: namespace caches by app version/build id, promote a new cache only after warmup completes, and roll back pending update state if warmup fails.

## Immediate shipped patch

The current code patch is intentionally smaller than the architecture plan. It fixes live signup/password behavior, mobile dropdown clipping, workspace modal clipping, storage wording, and Cognito email templates without attempting the larger sync refactor in the same deploy.
