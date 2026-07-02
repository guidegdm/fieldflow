# Local-First Data Pipeline Audit

Date: 2026-07-02

## Scope

I reviewed the current `reports/` structure first, then traced the IndexedDB/localStorage layer, sync client, background sync runner, and the main UI pages that read or write operational data.

## Findings

### High: several write paths bypass the local queue and go straight to the cloud

The app has a real mutation queue in IndexedDB and a background sync loop, but a number of important actions do not use it. `workflowStore.publish` POSTs directly to `/api/workflows/:id/publish` and only saves the published workflow after the request returns (`src/stores/workflowStore.ts:142,145,149,151,153`). The workflow builder also writes workflow definitions directly with `fetch(..., { method: "PUT" })` and then calls the same network-only publish path (`src/app/(routes)/admin/workflows/[id]/page.tsx:232,236,243,249,269,271,272,275`). Supervisor review sends an immediate `/api/sync/batch` request with a synthetic one-off mutation payload instead of appending a local outbox entry (`src/app/(routes)/supervisor/review/page.tsx:104,120,125,138,141,151,166,170`). Inventory reserve is also cloud-first: it reads from `/api/critical/inventory` and POSTs reserves directly (`src/app/(routes)/supervisor/inventory/page.tsx:28,31,34,39,41,42,48,58,64,69,72`). None of those flows are resumable from the local queue if the network drops mid-action.

### High: operational pages do not have durable local projections

The intended local projections exist in IndexedDB (`records`, `workflows`, `conflicts`, `attachments`, `device_state`, `mutations`), but several operational surfaces still treat the server as the canonical read model. Supervisor dashboard fetches `/api/workflows/:id/records` first and only falls back to IndexedDB on error (`src/app/(routes)/supervisor/dashboard/page.tsx:40,49,53,57,62`). Admin dashboard does the same for stats, workflows, and users (`src/app/(routes)/admin/dashboard/page.tsx:35,39,40,41,52,53,55,56,57,59,63,67,76,79,80`). Admin users has no local projection at all and is fetch-only (`src/app/(routes)/admin/users/page.tsx:42,43,44,55,57,64,94,99,104,118,123,124,126`). Supervisor inventory uses `localStorage` as a cache, but only after a successful fetch, so it is not a durable projection layer (`src/app/(routes)/supervisor/inventory/page.tsx:28,31,34,39,41,42,48`). The workflow list store is closer to local-first, but it still has a TTL gate and then replaces local state from `/api/workflows`, which makes cloud freshness win over local continuity (`src/stores/workflowListStore.ts:30,33,41,43,53,55,61,65,72,79,81,83,85`).

### Medium: record and review state transitions are inferred from text and timestamps

The record detail page does not replay an event log; it invents an audit timeline from the current record status and timestamps, including a hard-coded one-hour offset for synthetic conflict history (`src/app/(routes)/field-worker/record/[id]/page.tsx:43,45,48,51,54,55,58`). Supervisor review is also fragile: it classifies transitions by substring matching the transition key/label/labelEn for words like `reject`, `approve`, `verified`, `confirm`, and `close` (`src/app/(routes)/supervisor/review/page.tsx:322,323,326,327,331,333,334,335`). That means display text and translation can change business behavior. The result is an unpredictable state machine, not a data-driven one.

### Medium: the read path is fragmented, so the UI is only partially local-first

Field-worker home, search, and record detail all read IndexedDB first, then hit the server and overwrite the local copy when the server returns data (`src/app/(routes)/field-worker/home/page.tsx:52,53,55,57,59,60,61,66,73`, `src/app/(routes)/field-worker/search/page.tsx:48,51,52,53,54,57,58,60,64,65,67,68`, `src/app/(routes)/field-worker/record/[id]/page.tsx:93,98,99,104,105,110,113,117,122,124,125,126,130`). That is workable as a bootstrap strategy, but it is not a single projection boundary. A cold or stale projection is still pulled from the network directly instead of being rebuilt from the local model. The current sync code is already capable of maintaining local projections (`src/lib/sync/sync-client.ts:40,42,43,45,48,75,79,85,98,106,127,133,138,140,142,153,165,166,167,168,171,182`), but the UI pages are not consistently reading through that layer.

## Recommended pipeline architecture

Use IndexedDB as the device-side system of record for UI reads. Every UI surface should render from a local projection first, even if the projection is incomplete or stale, and the network should only refresh or repair that projection in the background.

Use a single outbox/mutation log for all writes. Record creation, edits, workflow publish, inventory reserve, user admin actions, and review actions should all enqueue a local command first, update the local projection immediately, and let the sync worker reconcile the command with the cloud. The existing mutation store and sync worker already point in this direction (`src/lib/db/indexeddb.ts:144,145,146,194,196,256,258,330,332,335,337,341,354,361,366`, `src/lib/sync/run-background-sync.ts:12,14,23,32,61,68`, `src/lib/sync/sync-client.ts:28,29,31,37,40,43,45,75,79,85,98,104,106,127,133,138,140,142,153,165,166,167,168,171,182`).

Keep cloud responses as projection updates, not ad hoc UI refreshes. The server should return `acked`, `failed`, `conflicts`, `server_changes`, and a sequence cursor; the client should apply those changes to IndexedDB and invalidate only the affected views. That model is already present in `fullSync`, but it needs to be the only path the UI depends on.

Add durable local projections for inventory, admin users, and workflow summaries. `localStorage` is fine for tiny preferences, but it is not a projection store. These views need IndexedDB-backed read models if the app is meant to behave like a mobile/desktop local-first client.

Replace label-based state inference with explicit workflow metadata. Transition records need an action/result field that survives localization, and record history should be an append-only event log instead of a timeline fabricated from the current status.

## Bottom line

Field-worker create/edit/conflict flows are partly local-first already, but the wider app is still mixed-mode. The core sync engine exists; the remaining work is to make every operational surface read from local projections and make every write enter the local queue before it talks to the cloud.
