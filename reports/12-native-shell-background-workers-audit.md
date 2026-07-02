# Native Shell / Background Workers Audit

Date: 2026-07-02
Branch: `master`

## Scope

Audit of the PWA/native shell background pipeline with emphasis on low-network behavior, background sync reliability, cache/version hygiene, and the shape of the coordinator that should own these flows.

## Findings

### High: service-worker sync events are only a message relay, so background sync does not reliably run when no page is open

What I found:
The service worker handles `sync` and `periodicsync` by posting `FIELD_FLOW_SYNC_NOW` to window clients. The actual push/pull work stays in the page layer, where `ServiceWorkerRegister` listens for the message and calls `runBackgroundSync`. That means the browser can wake the worker, but if there is no live client window, nothing actually syncs.

Why it matters:
This breaks the promise of robust low-network recovery. Pending mutations, attachments, and server changes only reconcile when a tab is open and able to receive the message.

References:
- `worker/index.js:99-129`
- `src/components/ServiceWorkerRegister.tsx:32-37, 42-54`
- `src/lib/sync/register-background-sync.ts:14-45`
- `src/lib/sync/run-background-sync.ts:12-69`

### High: sync/update/warmup triggers are fragmented, and `runBackgroundSync` is not coordinated across tabs or pipelines

What I found:
The root shell mounts several independent managers at once, and each of them can trigger sync-related work on its own. `useNetworkStatus` syncs on startup, reconnect, and custom network-mode events. `ServiceWorkerRegister` also calls `registration.update()`, flushes pending logout, and starts sync on worker messages. `AppUpdateManager` polls for app-version changes on online/focus/interval. Save flows in field-worker pages and offline conflict resolution also register background sync and then kick off `runBackgroundSync` directly.

`runBackgroundSync` serializes only within a single JS context via the local `activeSync` and `isSyncing` flags. It does not coordinate across tabs, workers, or separate trigger sources, so the same reconnect can fan out into multiple overlapping sync attempts and multiple UI state updates.

Why it matters:
This can produce duplicate network traffic, duplicate `pendingCount` churn, and confusing sync/update prompts. The app needs one pipeline owner, not a set of loosely related hooks.

References:
- `src/components/layout/ClientLayout.tsx:28, 65-70`
- `src/hooks/useNetworkStatus.ts:11-70`
- `src/components/ServiceWorkerRegister.tsx:28-54`
- `src/components/AppUpdateManager.tsx:176-207`
- `src/components/WorkspaceSyncManager.tsx:11-34`
- `src/app/(routes)/field-worker/register/page.tsx:122-130`
- `src/app/(routes)/field-worker/record/[id]/page.tsx:199-206`
- `src/lib/sync/offline-conflict-resolution.ts:104-108`
- `src/lib/sync/run-background-sync.ts:10-28, 31-69`

### Medium: page and warmup caches are durable but not versioned, so stale HTML/data can survive deploys and schema changes

What I found:
The runtime page cache is a fixed `fieldflow-pages` cache used by Workbox, the custom worker, client warmup, demo warmup, and session cleanup. The demo sandbox also persists into `fieldflow-demo-sandbox`, and inventory warmup uses `fieldflow-inventory-${org.id}`. These stores are time-based or ad hoc, not build-versioned. The only versioned key in this area is the warmup marker `fieldflow-offline-warmup-v1`, which does not invalidate the actual cached content.

Why it matters:
A new release can still reuse old but valid HTML, stale workspace snapshots, or stale inventory data after route or schema changes. `AppUpdateManager` tracks the app version for prompting, but it does not namespace or rotate the caches themselves.

References:
- `next.config.ts:25-34, 43-73`
- `worker/index.js:38-50, 142-179`
- `src/components/OfflineWarmup.tsx:19, 71-89, 119-165, 199-243`
- `src/lib/demo/offline-demo-cache.ts:10, 234-247, 326-335`
- `src/lib/auth/client-session-cleanup.ts:7-24`
- `src/components/AppUpdateManager.tsx:9-40, 130-193`

## Coordinator That Should Exist

FieldFlow needs one background pipeline coordinator in the root shell that owns all of the following:

1. A single cross-tab lock/lease for sync work.
2. One queue that merges triggers from `online`, `focus`, `sync`, `periodicsync`, manual save, and offline conflict resolution.
3. One place to run attachment upload, local mutation push, remote pull, conflict refresh, route warmup, logout flush, and update polling in a controlled order.
4. One state channel for the UI, so sync progress, pending counts, and update readiness change once per pipeline, not once per trigger.
5. Versioned cache namespaces for page and warmup data, tied to the app build or route manifest.

Without that coordinator, the current behavior is functionally redundant but operationally noisy: it works when the page is live, but it is not a stable background pipeline.
