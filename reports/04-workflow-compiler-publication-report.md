# Workflow Compiler / Publication Audit

Scope: `docs/docs/diagrams/mermaid/09-workflow-compiler-publication.mmd` versus the implemented admin builder, AI authoring, save/publish APIs, workflow storage, cache sync, and worker/offline path.

## Verified trace

- The admin workflow builder loads a workflow definition from `GET /api/workflows/:id/definition`, falls back to IndexedDB, and saves edits back through `PUT /api/workflows/:id/definition`; publish is a separate `POST /api/workflows/:id/publish` call. See [admin builder](<D:/Dev/hackatons/FieldFlow/src/app/(routes)/admin/workflows/[id]/page.tsx:194>), [definition API](<D:/Dev/hackatons/FieldFlow/src/app/api/workflows/[id]/definition/route.ts:20>), and [publish API](<D:/Dev/hackatons/FieldFlow/src/app/api/workflows/[id]/publish/route.ts:5>).
- AI generation is real and is wired into the builder, but it is client-side agentic assistance rather than a publish/compiler stage. The prompt is sent to `/api/ai/agent`, the loop validates proposals, and the builder applies ghost field/state/transition suggestions manually. See [AI prompt hook](<D:/Dev/hackatons/FieldFlow/src/components/builder/FieldPalette.tsx:40>), [agent loop](<D:/Dev/hackatons/FieldFlow/src/lib/ai/agent-loop.ts:121>), [proposal validation](<D:/Dev/hackatons/FieldFlow/src/lib/ai/validator/validate.ts:11>), and [ghost proposal UI](<D:/Dev/hackatons/FieldFlow/src/components/builder/WorkflowFlow.tsx:156>).
- Server sync does carry `workflow_definition` changes back into IndexedDB during batch sync. See [sync client](<D:/Dev/hackatons/FieldFlow/src/lib/sync/sync-client.ts:20>) and [sync batch handler](<D:/Dev/hackatons/FieldFlow/src/app/api/sync/batch/route.ts:125>).
- Published workflow selection is cached in IndexedDB and in the active-workflow store, then mirrored into device state. See [workflow list cache](<D:/Dev/hackatons/FieldFlow/src/stores/workflowListStore.ts:26>), [active workflow store](<D:/Dev/hackatons/FieldFlow/src/stores/activeWorkflowStore.ts:19>), and [workflow context](<D:/Dev/hackatons/FieldFlow/src/hooks/useWorkflowContext.ts:11>).
- The app does register a service worker and warm offline routes, but only in production, and the worker itself is navigation-cache focused. See [service worker registration](<D:/Dev/hackatons/FieldFlow/src/components/ServiceWorkerRegister.tsx:5>), [offline warmup](<D:/Dev/hackatons/FieldFlow/src/components/OfflineWarmup.tsx:66>), and [worker script](<D:/Dev/hackatons/FieldFlow/worker/index.js:27>).

## Findings

### 1. Critical: published workflows are mutable, not immutable versions

The diagram says publish creates a versioned workflow item and implies immutability. The code does not. The `PUT` route overwrites the current workflow record in place and accepts caller-supplied `version`, `status`, and `publishedAt`; the `POST /publish` route mutates the same stored object and increments its version. The client store also marks the workflow published optimistically even if the server request fails. See [definition API](<D:/Dev/hackatons/FieldFlow/src/app/api/workflows/[id]/definition/route.ts:33>), [publish API](<D:/Dev/hackatons/FieldFlow/src/app/api/workflows/[id]/publish/route.ts:18>), and [optimistic local publish](<D:/Dev/hackatons/FieldFlow/src/stores/workflowStore.ts:137>).

Impact: there is no version history, no immutable snapshot, and no authoritative publish confirmation. A later save can rewrite a previously published workflow in place.

Suggestion: store published workflow versions as separate immutable snapshots, have publish return the authoritative saved record, and update the client only from the successful response.

### 2. High: there is no server-side validation/compile gate for manual save or publish

The diagram’s “Validate definition” and “Compile workflow manifest” stages are not enforced on the real manual edit path. The builder sends the raw `WorkflowDefinition` to the API on save, and publish just chains `persistWorkflow()` then `publish()`. The only structured validation I found is for AI proposals, not for the workflow persisted by humans. See [builder save/publish flow](<D:/Dev/hackatons/FieldFlow/src/app/(routes)/admin/workflows/[id]/page.tsx:227>) and [AI-only validation](<D:/Dev/hackatons/FieldFlow/src/lib/ai/validator/validate.ts:11>).

Impact: invalid transition graphs, missing labels, bad role references, or malformed offline settings can be stored and published if they are entered manually.

Suggestion: move workflow validation into the server `PUT` and `POST /publish` handlers, and reject publication when the workflow does not satisfy the compiler rules.

### 3. High: offline-policy and attachment rules are not compiled into runtime behavior

The workflow model contains `offlinePolicy`, but the runtime attachment path ignores it. Photo uploads are hard-capped at 10 MB in the field renderer, the presign endpoint enforces a separate 1.1 MB compressed payload limit, and image compression uses fixed WebP targets. The builder’s settings tab only shows version/status metadata, not offline policy controls. See [draft workflow defaults](<D:/Dev/hackatons/FieldFlow/src/app/(routes)/admin/workflows/[id]/page.tsx:107>), [builder settings tab](<D:/Dev/hackatons/FieldFlow/src/app/(routes)/admin/workflows/[id]/page.tsx:558>), [field photo cap](<D:/Dev/hackatons/FieldFlow/src/components/fields/FieldRenderer.tsx:23>), [presign request cap](<D:/Dev/hackatons/FieldFlow/src/app/api/attachments/presign/route.ts:6>), and [image compression targets](<D:/Dev/hackatons/FieldFlow/src/lib/media/image-compression.ts:3>).

Impact: changing `offlinePolicy.maxAttachmentSizeMb`, conflict strategy, or attachment settings in the workflow definition does not change the actual runtime limits.

Suggestion: either derive attachment/offline rules from the workflow definition at compile time or remove the dead fields so the model matches the runtime.

### 4. Medium: local draft workflows can be wiped by the published-workflow cache refresh

The IndexedDB workflow cache is managed as a published-only mirror. `workflowListStore` filters to published workflows, then `replaceWorkflowsForOrg()` deletes every existing workflow for that org before writing the server result. That means any offline draft saved locally can disappear on the next successful list refresh. See [workflow list store](<D:/Dev/hackatons/FieldFlow/src/stores/workflowListStore.ts:35>) and [IndexedDB replacement](<D:/Dev/hackatons/FieldFlow/src/lib/db/indexeddb.ts:174>).

Impact: offline draft edits are not durable across reloads or any code path that refreshes the published list from the server.

Suggestion: store drafts separately from published workflows, or merge by status/version instead of replacing the entire org cache.

### 5. Medium: the “visual workflow builder” is mostly read-only for states, transitions, and policy

The state model exists, but the admin UI does not expose actual editors for state properties, transition roles, or offline policy. The flow tab allows add/remove of states and removal of transitions, while the state side panel only renders read-only labels, keys, colors, and flags. `updateState` is imported but not used in the page, and there is no UI for editing `requiredRoles` or `sideEffects`. See [flow tab state/transition UI](<D:/Dev/hackatons/FieldFlow/src/app/(routes)/admin/workflows/[id]/page.tsx:460>) and [read-only state panel](<D:/Dev/hackatons/FieldFlow/src/app/(routes)/admin/workflows/[id]/page.tsx:124>).

Impact: the diagram overstates the completeness of the admin builder surface.

Suggestion: add explicit editors for state metadata, transition rules, and offline policy, or update the docs to reflect the narrower builder.

### 6. Low: worker availability is production-only and the worker does not cache definitions by default

The service worker registers only in production builds. The worker script itself caches navigations and URLs explicitly sent to it; workflow definitions are not a dedicated cache target in the worker. Offline route warmup compensates by prefetching pages and by seeding IndexedDB, but that is separate from the worker. See [service worker registration](<D:/Dev/hackatons/FieldFlow/src/components/ServiceWorkerRegister.tsx:7>), [worker fetch handler](<D:/Dev/hackatons/FieldFlow/worker/index.js:27>), and [offline warmup cache flow](<D:/Dev/hackatons/FieldFlow/src/components/OfflineWarmup.tsx:159>).

Impact: the offline path is real, but it depends on production registration plus warmup behavior; it is not a generic “worker always available” guarantee.

Suggestion: if offline definition loading is a hard requirement, cache workflow definitions explicitly and document the production-only registration split.

## Bottom line

The diagram matches the broad product intent, but the implementation is much less compiler-like than the mermaid chart suggests. In practice, the system persists and republishes raw `WorkflowDefinition` objects, validates only AI-generated proposals, and treats publish as a mutable update rather than an immutable version boundary.
