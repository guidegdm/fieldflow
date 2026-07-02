# Sync Engine / Cloud Protocol Audit

Date: 2026-07-02
Branch: `audit`

## Scope

This audit covers the sync client, batch sync route, conflict route, Dynamo-backed store, mutation schema, idempotency, device checkpoints, retry behavior, and failure handling.

## Findings

### High: batch sync can acknowledge work that never finished

Evidence:
- `src/app/api/sync/batch/route.ts:145-165` short-circuits any operation whose `client_id` already exists in the store and treats it as acknowledged.
- `src/app/api/sync/batch/route.ts:374-386` claims a mutation, writes the record, then completes the mutation in separate steps.
- `src/lib/api/in-memory-store.ts:106-126` and `src/lib/api/dynamo-store.ts:673-687` persist the claim as its own write before the record update and final mutation completion.
- `src/app/api/sync/batch/route.ts:434-458` writes the device checkpoint after the batch, outside any transaction that covers the mutation or record writes.

Why this matters:
If the server crashes, times out, or hits a Dynamo failure after the claim but before the record write or completion write, the next retry will see the mutation row and auto-ack it without reapplying the record change. That turns a transient failure into a silent data-loss path. The device checkpoint is updated separately, so the batch can also advance the checkpoint even when the true end state is only partially committed.

Recommendation:
Make claim, record mutation, conflict creation, and checkpoint advancement atomic, or persist an explicit committed/failed state that the retry path can distinguish from a partially claimed mutation.

### High: conflict resolution is not idempotent and can double-apply on retry

Evidence:
- `src/app/api/sync/conflict/route.ts:81-105` mutates conflict rows and the record before writing any sync mutation marker.
- `src/app/api/sync/conflict/route.ts:107-124` generates a new synthetic mutation with `client_id: conflict-resolution-${record.id}-${now}` on every request.
- `src/lib/api/in-memory-store.ts:206-227` and `src/lib/api/dynamo-store.ts:435-446,664-687` store conflict, record, and mutation rows as separate writes with no surrounding transaction.

Why this matters:
If the request succeeds in updating the record but fails before the synthetic mutation is stored, a retry produces a second `client_id`, applies the resolution again, and bumps the record version again. This makes conflict closure unstable under retries and breaks deterministic replay semantics.

Recommendation:
Give conflict resolution a stable idempotency key and commit the conflict row, record update, and resolution marker in one transaction.

### Medium: sync can fail even with internet because transport retries are too weak

Evidence:
- `src/lib/api/client.ts:1-32` aborts any request after 15 seconds and only auto-retries 401 responses.
- `src/lib/sync/run-background-sync.ts:31-66` only retries when the caller passes `options.retry`, and that path is capped at two attempts.
- `src/hooks/useNetworkStatus.ts:13-18` calls `runBackgroundSync(user)` without retries on reconnect.
- `src/app/(routes)/field-worker/register/page.tsx:128-130` and `src/app/(routes)/field-worker/record/[id]/page.tsx:202-206` also invoke the non-retry path.

Why this matters:
A reachable but slow API, a transient 5xx, or a brief auth-refresh failure can surface as `Sync failed` even though the device is online. The default reconnect path does not back off, and the client timeout is short enough that larger batches can fail under ordinary latency.

Recommendation:
Use retries by default on reconnect paths, retry timeout/5xx/429 failures with backoff, and separate transport failures from logical server rejections in the UI state.

## Notes

- The mutation schema itself is permissive by design, but the real safety issue is that the server trusts existence of a mutation row more than its completion state.
- I did not see a separate transactional boundary around the Dynamo write path that would protect record state, conflict state, and device checkpoints together.
