# Workflow / Record / Review / Inventory Audit

Date: 2026-07-02
Branch: `audit`

## Scope

This audit checks admin workflow editing/publication, field-worker register/record/home, supervisor dashboard/review/inventory, the active workflow store, invalidation, optimistic updates, and API usage against a local-first pipeline goal.

## Findings

### High: admin workflow writes bypass the local mutation queue

Files:
- `src/app/(routes)/admin/workflows/[id]/page.tsx:232-253`
- `src/app/(routes)/admin/workflows/[id]/page.tsx:269-275`
- `src/app/(routes)/admin/workflows/page.tsx:65-80`
- `src/stores/workflowStore.ts:142-154`

Risk:
Workflow saves, publishes, and archives go straight to the HTTP API. When the request fails, the code writes a snapshot to IndexedDB, but it never enqueues a mutation for later replay. That makes workflow authoring cloud-first with an offline fallback, not local-first pipeline behavior.

### High: field-worker edits can leave reviewed records in a terminal status while the data is pending sync

Files:
- `src/app/(routes)/field-worker/record/[id]/page.tsx:167-206`
- `src/app/(routes)/supervisor/dashboard/page.tsx:67-78`
- `src/app/(routes)/supervisor/review/page.tsx:156-170`

Risk:
`saveEdit()` updates the record body and sets `syncStatus: "pending"`, but it only downgrades `status` when the old status was `"synced"`. If an approved or rejected record is edited locally, it stays approved/rejected in IndexedDB and in the dashboard filters even though it now has unsynced changes. The review queue and the local projection diverge.

### High: supervisor review and inventory actions write directly to cloud APIs instead of staging local mutations

Files:
- `src/app/(routes)/supervisor/review/page.tsx:104-170`
- `src/app/(routes)/supervisor/inventory/page.tsx:53-74`
- `src/lib/sync/offline-conflict-resolution.ts:76-108`
- `src/app/api/sync/batch/route.ts:145-405`
- `src/app/api/critical/inventory/reserve/route.ts:13-32`

Risk:
The offline conflict path uses `db.enqueueMutation()` and invalidation. The supervisor review path does not; it POSTs straight to `/api/sync/batch`, then patches only the current record in IndexedDB. Inventory reservation is even more direct: it POSTs to `/api/critical/inventory/reserve` with no local queue or optimistic stock projection. Both flows break when the device is offline and both skip the local intent log that the rest of the app relies on.

### Medium: workflow publication does not propagate to idle local devices

Files:
- `src/stores/workflowStore.ts:142-154`
- `src/lib/invalidation.ts:7-21`
- `src/app/api/workflows/[id]/publish/route.ts:30-46`
- `src/lib/sync/sync-client.ts:40-50,127-183`
- `src/hooks/useNetworkStatus.ts:13-18,28-37`
- `src/components/ServiceWorkerRegister.tsx:28-37`

Risk:
Publishing stores a `workflow_definition` mutation on the server, and the local tab invalidates its own `workflows` topic. But `invalidate()` is window-scoped, and other devices only pick up server changes when `fullSync()` runs. That sync is triggered on reconnect or explicit sync messages, not by publication itself, so a connected idle device can keep using an old workflow definition until some unrelated sync happens.

## Bottom Line

The record/register path is largely local-first. The main gaps are the admin workflow write path, the supervisor review and inventory writes, and the publication propagation model. The biggest status bug is the record edit flow keeping approved/rejected statuses while the edited data is still pending sync.
