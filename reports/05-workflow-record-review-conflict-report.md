# Workflow Record Review / Conflict Audit

Scope: admin creation -> dashboard/list freshness -> workflow builder/publish -> record registration -> supervisor review -> admin/supervisor queues -> status transitions -> conflict trigger/resolution.

Overall, the journey is workable, but it is too optimistic about freshness and too trusting of client-provided workflow state. The biggest risks are stale workflow lists after publish, silent local-only saves when backend writes fail, and server-side update paths that accept or mutate invalid states.

## 1. Workflow list freshness is cache-bound, not invalidation-bound

Severity: High

Evidence: `src/stores/workflowListStore.ts:26-29` returns cached workflows immediately if `byOrgId[orgId]` already has entries. `src/hooks/useWorkflowContext.ts:21-33` only calls `loadForOrg(orgId)` on org changes, and `src/components/layout/WorkflowSwitcher.tsx:23-25` only loads when the list is empty. The admin dashboard and workflows index both fetch once on mount: `src/app/(routes)/admin/dashboard/page.tsx:35-85` and `src/app/(routes)/admin/workflows/page.tsx:32-66`.

Impact: after an admin publishes or edits a workflow, other screens in the same browser session can keep showing the old workflow list and old active workflow object until the page is remounted or the whole app is reloaded. This is especially visible in the workflow switcher and any field-worker/supervisor screen that depends on the cached workflow list.

Recommendation: add an explicit invalidation path after workflow save/publish, and make the context hook support a forced refresh instead of relying on "empty cache only" loading.

## 2. Builder save/publish is optimistic in a way that can hide backend failure

Severity: High

Evidence: `src/app/(routes)/admin/workflows/[id]/page.tsx:227-247` saves locally even when the PUT fails, then continues as if the workflow is saved. `src/app/(routes)/admin/workflows/[id]/page.tsx:263-268` publishes after save without checking the result of either step. `src/stores/workflowStore.ts:137-154` ignores the POST response entirely and always marks the workflow as published locally. The backend endpoints do not enforce an immutable publish model: `src/app/api/workflows/[id]/definition/route.ts:20-66` still accepts writes to any workflow, and `src/app/api/workflows/[id]/publish/route.ts:5-40` just increments version and stores the mutation.

Impact: the UI can say a workflow is saved or published even when the server write failed. A manual refresh then rehydrates from server state and can drop the local changes entirely, because offline/local-only edits are not queued as mutations. The publish modal copy also overstates the semantics of the backend, because the workflow definition is still editable.

Recommendation: either queue workflow edits as mutations or fail visibly and roll back local state on backend failure. If published workflows are meant to be immutable, enforce that on the PUT route instead of only in copy.

## 3. Status transitions are under-validated on the server

Severity: High

Evidence: `src/app/api/sync/batch/route.ts:143-168` accepts `payload.status` and `payload.state` for create operations without checking that the transition is legal for the workflow. In the update path, `src/app/api/sync/batch/route.ts:288-305` mutates the record object before the transition check completes. The in-memory store returns live object references, not copies: `src/lib/api/in-memory-store.ts:41-49` and `src/lib/api/in-memory-store.ts:69-82`.

Impact: a client can submit a record directly into an arbitrary status/state, bypassing the workflow journey entirely. On update, an invalid state transition can still partially mutate the shared object before the handler returns `INVALID_STATE_TRANSITION`, because the object is already the live Map value. That is both a validation bug and a concurrency hazard.

Recommendation: validate create and update transitions against the workflow definition before mutating any record object. Return defensive copies from the store, or clone before write, so failed validation cannot leak partial state.

## 4. Queue screens are fetch-once views, so review status can lag behind reality

Severity: Medium

Evidence: the supervisor dashboard loads records once in `src/app/(routes)/supervisor/dashboard/page.tsx:34-57` and never subscribes to sync completion. The review page does the same in `src/app/(routes)/supervisor/review/page.tsx:63-88`, then posts the decision to `/api/sync/batch` at `src/app/(routes)/supervisor/review/page.tsx:102-158` and immediately navigates away if the request succeeds. The field-worker home and search pages also hydrate once from IndexedDB/server and then stay on that snapshot: `src/app/(routes)/field-worker/home/page.tsx:40-77` and `src/app/(routes)/field-worker/search/page.tsx:43-69`.

Impact: after a background sync, another device's review action, or a conflict resolution, these pages do not automatically refresh their record lists. The user often has to leave and re-enter the route, or hard refresh, before the queue counts and row states line up with the server. The sync subsystem updates counters (`src/lib/sync/run-background-sync.ts:30-66`, `src/lib/sync/sync-client.ts:54-108`), but it does not push list invalidation into the page components.

Recommendation: subscribe the list views to a shared refresh signal, or explicitly refetch records after sync/review/conflict mutations complete.

## 5. Conflict handling resolves data, but the visible queue can stay stale

Severity: Medium

Evidence: conflict detection is raised during sync in `src/app/api/sync/batch/route.ts:302-325`, and the conflict resolution route updates the record and conflict rows in place at `src/app/api/sync/conflict/route.ts:66-108`. The client side conflict pages only load once: `src/app/(routes)/field-worker/conflicts/page.tsx:23-54` and `src/app/(routes)/supervisor/conflicts/page.tsx:22-62`. The sync client refreshes IndexedDB conflict rows at `src/lib/sync/sync-client.ts:54-108`, but it does not tell the conflict pages to re-query after a resolve.

Impact: after a resolution succeeds, the queue list can stay stale until the page is remounted. The resolved data is stored, but the list view is not invalidated.

Recommendation: after resolving a conflict, force the page to reload its conflict query or clear the local conflict list from the component state.

## 6. Adjacent admin actions are optimistic only in the UI

Severity: Low to Medium

Evidence: the admin users page updates invite results locally at `src/app/(routes)/admin/users/page.tsx:54-93`, but the role and active toggles are local state only and do not persist anywhere. The settings page is even more explicit: `src/app/(routes)/admin/settings/page.tsx:33-39` just waits and flips a success flag.

Impact: these controls look like they perform durable mutations, but a refresh reverts them. If the admin workflow expects these to feed downstream dashboards or permissions, the current implementation will not do that.

Recommendation: either wire these actions to real mutations or label them as demo-only so they are not mistaken for durable state changes.

## False claims

`src/app/(routes)/admin/workflows/[id]/page.tsx:351-355` says publishing will create a "version immuable", but `src/app/api/workflows/[id]/definition/route.ts:20-66` still accepts writes to the same workflow and `src/app/(routes)/admin/workflows/[id]/page.tsx:227-247` still saves over it.

`src/stores/workflowStore.ts:137-154` and `src/app/(routes)/admin/workflows/[id]/page.tsx:263-268` present publish as a successful action even when the backend call fails, because the UI always advances to the published local state.

## DB concurrency risks

The in-memory store is a shared mutable singleton, and its getters hand out live objects. `src/lib/api/in-memory-store.ts:39-49`, `src/lib/api/in-memory-store.ts:69-82`, and `src/lib/api/in-memory-store.ts:97-102` all write directly into shared Maps with no version check or lock. That means concurrent requests can interleave and overwrite each other's edits.

The DynamoDB path has the same shape for workflow, record, conflict, and mutation writes: `src/lib/api/dynamo-store.ts:225-235`, `src/lib/api/dynamo-store.ts:262-270`, `src/lib/api/dynamo-store.ts:309-316`, and `src/lib/api/dynamo-store.ts:535-541` use unconditional `PutCommand`s rather than optimistic conditional writes. Inventory reservation is the exception, not the rule.

Combined with the sync handler's read-modify-write pattern in `src/app/api/sync/batch/route.ts:117-325`, this creates a real lost-update risk under concurrent publish/save/review traffic. The code is behaving like a single-writer system even though the app is exposed as multi-user.

## Recommendations

1. Add explicit workflow-list invalidation after publish/save/delete and after any action that changes workflow visibility.
2. Replace local-only optimistic workflow save/publish with queued mutations or rollback-on-failure semantics.
3. Enforce allowed state transitions on the server for both create and update, and reject illegal `status`/`state` payloads before mutating.
4. Stop returning live mutable objects from the store; clone on read or write through versioned snapshots.
5. Add version/conditional checks to record and workflow writes, especially in DynamoDB mode.
6. Refetch dashboard, review, search, home, and conflict lists after sync or resolution instead of relying on remounts.
7. Remove or narrow any UI copy that promises immutability or success before the backend has actually accepted the change.
