# Offline Sync

FieldFlow combines a production PWA shell, IndexedDB local data, a local mutation queue, and a page-owned sync pipeline. The app is designed to keep the browser useful when network access is unreliable, then reconcile with the server when online.

## PWA Runtime

The global runtime helpers are mounted from [src/components/layout/ClientLayout.tsx](../src/components/layout/ClientLayout.tsx:65). `next-pwa` is enabled in production and emits `/sw.js`; the custom worker source is [worker/index.js](../worker/index.js).

The service worker handles page caching and relays `sync` / `periodicsync` events to open clients in [worker/index.js](../worker/index.js:145). The actual sync logic runs in the page through [src/lib/sync/pipeline-coordinator.ts](../src/lib/sync/pipeline-coordinator.ts:86), [src/lib/sync/run-background-sync.ts](../src/lib/sync/run-background-sync.ts:12), and [src/lib/sync/sync-client.ts](../src/lib/sync/sync-client.ts:127).

## Cache Layers

| Layer | Behavior |
| --- | --- |
| Custom page cache | Versioned `fieldflow-pages` cache for HTML navigations, managed by [worker/index.js](../worker/index.js:20). |
| `next-pwa` runtime cache | Network-only for `/api/*`, network-first for navigations, stale-while-revalidate for JS/CSS/workers, cache-first for images in [next.config.ts](../next.config.ts:43). |
| Warmup cache | Explicitly warms important routes in [src/components/OfflineWarmup.tsx](../src/components/OfflineWarmup.tsx:86). |
| Update cache | Warms and promotes a new page cache before reload in [src/components/AppUpdateManager.tsx](../src/components/AppUpdateManager.tsx:134). |

API GET responses are not cached for offline replay. Offline data comes from IndexedDB and warmed pages, not from cached API responses.

## IndexedDB Stores

The local database is `fieldflow` version 3 in [src/lib/db/indexeddb.ts](../src/lib/db/indexeddb.ts:116). It contains:

- `mutations`
- `records`
- `workflows`
- `attachments`
- `device_state`
- `conflicts`
- `projections`

Records, workflows, and conflicts are org-scoped locally by rewriting stored IDs as `orgId::remoteId` while preserving remote IDs for app use. See [src/lib/db/indexeddb.ts](../src/lib/db/indexeddb.ts:31).

Attachments store compressed/local image blobs and upload state in IndexedDB. The retry path is [src/lib/attachments/sync-pending.ts](../src/lib/attachments/sync-pending.ts:33).

## Local-First Writes

Record creation and edits write local data first, enqueue a mutation, register background sync if available, and request pipeline sync.

- Field-worker create: [src/app/(routes)/field-worker/register/page.tsx](<../src/app/(routes)/field-worker/register/page.tsx:74>)
- Field-worker edit: [src/app/(routes)/field-worker/record/[id]/page.tsx](<../src/app/(routes)/field-worker/record/[id]/page.tsx:162>)
- Supervisor review: [src/app/(routes)/supervisor/review/page.tsx](<../src/app/(routes)/supervisor/review/page.tsx:108>)
- Workflow builder save/publish: [src/app/(routes)/admin/workflows/[id]/page.tsx](<../src/app/(routes)/admin/workflows/[id]/page.tsx:239>)

When offline, [src/lib/sync/run-background-sync.ts](../src/lib/sync/run-background-sync.ts:12) returns early and only keeps pending counts fresh. When the browser reconnects, [src/hooks/useNetworkStatus.ts](../src/hooks/useNetworkStatus.ts:13) triggers sync if the app is not in simulated offline mode.

## Sync API

Client sync posts to `POST /api/sync/batch` with `device_id`, `device_seq`, and up to 100 queued operations. The endpoint is implemented in [src/app/api/sync/batch/route.ts](../src/app/api/sync/batch/route.ts:29).

The response contains:

- `acked`
- `failed`
- `conflicts`
- `server_changes`
- `last_seq`
- `server_timestamp`

The client deletes acked mutations, updates failed mutation retry state, writes conflict rows locally, applies server changes, and updates `device_state` in [src/lib/sync/sync-client.ts](../src/lib/sync/sync-client.ts:156).

`fullSync()` loops in batches of 100 for up to 25 batches per run in [src/lib/sync/sync-client.ts](../src/lib/sync/sync-client.ts:132).

## Conflict Handling

Server conflict resolution compares live server record state, mutation `base_version`, mutation `base_fields`, and workflow `offlinePolicy`. The logic lives in [src/app/api/sync/batch/route.ts](../src/app/api/sync/batch/route.ts:284).

Implemented strategies include:

- manual escalation
- set union for multi-select values
- append-only textareas
- numeric average/max/min
- server-authoritative resolution
- last-write-wins fallback

Unresolved conflicts are persisted as `OPEN` conflicts and returned to the client. Offline conflict resolution writes the selected local values, marks local conflicts resolved, enqueues an update mutation, and requests sync in [src/lib/sync/offline-conflict-resolution.ts](../src/lib/sync/offline-conflict-resolution.ts:46).

## Warmup And Demo Hydration

`OfflineWarmup` runs only when online and not on a constrained connection. It uses idle time where available, then warms app routes, current workspace routes, inventory projections, and demo data in [src/components/OfflineWarmup.tsx](../src/components/OfflineWarmup.tsx:269).

Demo sandbox snapshots are stored in localStorage by [src/lib/demo/offline-demo-cache.ts](../src/lib/demo/offline-demo-cache.ts:326) and refreshed after about 6 hours. Demo record routes are explicitly cached in [src/lib/demo/offline-demo-cache.ts](../src/lib/demo/offline-demo-cache.ts:234).

## Known Limitations

- Background sync is not a fully autonomous worker-side sync engine; it needs an open client to receive the worker message.
- Offline route availability depends on service worker control and successful warmup of that page or route family.
- `/api/*` routes are network-only by design.
- App update prompts are version-gated and snoozable, so a fresh deployment may not prompt immediately in every tab.
