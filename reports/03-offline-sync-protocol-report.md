# Offline Sync Protocol Audit

Scope: compared the protocol diagram at `docs/docs/diagrams/mermaid/04-offline-sync-protocol.mmd:15-60` against the local sync implementation in the IndexedDB queue, sync client, server batch route, conflict flows, and UI connectivity/status surfaces.

## What matches the diagram

- The client does persist mutations locally in IndexedDB and reads them back in deterministic order. See `src/lib/db/indexeddb.ts:57-68`.
- The background sync path does read local attachments first, then pending mutations, then posts a batch to `/api/sync/batch`. See `src/lib/sync/run-background-sync.ts:30-53`, `src/lib/sync/sync-client.ts:8-17`.
- The batch route does implement idempotency by checking prior mutations for the same `client_id` and org before reapplying work. See `src/app/api/sync/batch/route.ts:117-134`, `src/lib/api/in-memory-store.ts:91-102`.
- The app shell does mount the connectivity bar and the network-status hook globally, so online/offline state is not page-local. See `src/components/layout/ClientLayout.tsx:23-47`, `src/components/layout/AppShell.tsx:80-96`.

## Findings

### 1. Conflict resolution is not durable end to end

The field-worker conflict page resolves through `/api/sync/conflict`, but on failure it only updates the local conflict rows and does not enqueue a mutation or trigger a sync pass. See `src/app/(routes)/field-worker/conflicts/page.tsx:56-74`. The supervisor conflict page has the same shape, and its offline fallback mutates the local record plus local conflicts without queueing anything for later upload. See `src/app/(routes)/supervisor/conflicts/page.tsx:64-98`.

The server route itself does create a mutation when it receives the POST, which means the offline fallbacks are bypassing the actual sync protocol rather than using a weaker server path. See `src/app/api/sync/conflict/route.ts:66-107`.

Impact: offline conflict resolution can be lost after refresh, and online resolution does not refresh the local IndexedDB sync state unless another sync happens later.

### 2. Sync failures are recorded as if a sync completed successfully

`performSync()` sets `lastSyncAt` in both the success path and the catch path. See `src/lib/sync/run-background-sync.ts:51-62`. The field-worker status page renders that value as the "last sync" timestamp. See `src/app/(routes)/field-worker/status/page.tsx:84-88`.

Impact: a failed sync attempt still looks like a completed sync in the UI, which is a false success signal.

### 3. Retry and poison handling are only partially wired

Manual sync uses `retryWithBackoff()` around `fullSync()`. See `src/hooks/useSync.ts:10-13` and `src/lib/sync/run-background-sync.ts:51-53`. Reconnect-triggered sync does not pass `retry: true`, so it skips that retry layer. See `src/hooks/useNetworkStatus.ts:13-18`, `src/hooks/useNetworkStatus.ts:33-45`.

The per-mutation poison logic only runs when the server returns explicit `failed` entries. `markMutationFailed()` increments `retry_count` and flips to `POISON` only on those responses. See `src/lib/db/indexeddb.ts:90-105`, `src/lib/sync/sync-client.ts:93-95`. If `fullSync()` throws on transport failure before the server returns a batch response, the catch path just updates the timestamp and pending count, then exits. See `src/lib/sync/run-background-sync.ts:30-64`.

Impact: transport failures do not increment retry state, do not poison mutations, and do not get the same retry behavior as manual sync. This is unstable for flaky networks.

### 4. Batch draining is capped at 100 and does not loop

`pushBatch()` sends only `pending.slice(0, 100)`. See `src/lib/sync/sync-client.ts:8-17`. `fullSync()` sends one batch and then returns; there is no drain loop to continue while more local mutations remain. See `src/lib/sync/sync-client.ts:68-108`.

On both the client and server, `pending_count` is then forced to `0` regardless of whether more local mutations still exist. See `src/lib/sync/sync-client.ts:102-106` and `src/app/api/sync/batch/route.ts:356-379`.

Impact: a device with more than 100 queued mutations can finish a sync with a non-empty backlog while the device-state counters claim everything is clear.

### 5. Conflict mutation status is dropped after ACK deletion

In `fullSync()`, ACKED mutation rows are deleted first. See `src/lib/sync/sync-client.ts:88-91`. After that, `saveConflicts()` tries to mark the same `client_id` as `CONFLICT`. See `src/lib/sync/sync-client.ts:33-51`.

Because the row has already been deleted, that status write is a no-op. The queue cannot retain a durable "acked but conflicted" mutation state.

Impact: the local mutation log loses conflict history at the exact moment the conflict is acknowledged, which weakens traceability and makes conflict handling harder to inspect.

### 6. Local connectivity status can diverge from actual browser offline state in dev mode

`ConnectivityBar.handleMode()` always sets `isOnline` to `mode !== "offline"`. See `src/components/layout/ConnectivityBar.tsx:44-50`. The canonical network hook uses both the simulator mode and `navigator.onLine`, and it also re-evaluates on browser online/offline events. See `src/hooks/useNetworkStatus.ts:24-45`, `src/hooks/useNetworkStatus.ts:54-60`.

Impact: in development, the visual connectivity banner can claim online status even when the browser is offline, depending on which path fired last.

## Protocol gaps worth calling out

- The diagram says the client will "mark local records synced, failed, or conflict" after the batch response. The actual client writes back the server-returned payloads through `applyServerChanges()` and only explicitly deletes ACKED mutations plus marks failed/conflict rows. See `src/lib/sync/sync-client.ts:20-30`, `src/lib/sync/sync-client.ts:68-108`.
- The diagram shows a clean handoff from conflict detection to local UI updates. In practice, the UI conflict counters are refreshed only during sync completion, not after conflict resolution itself. See `src/lib/sync/run-background-sync.ts:54-57`, `src/stores/syncStore.ts:4-27`, `src/app/(routes)/field-worker/status/page.tsx:23-25`, `src/app/(routes)/field-worker/status/page.tsx:90-94`.

## Bottom line

The core offline queue, server batch endpoint, and idempotent replay path are implemented and broadly aligned with the diagram. The weakest points are conflict resolution durability, retry/poison completeness, and batch draining. Those are the parts most likely to lose user work or show a healthy UI while the queue is still dirty.

