# Workflow Engine

FieldFlow's workflow engine is currently a single-workflow, single-entity runtime. A workflow definition contains one entity, fields, states, transitions, roles, offline policy, lifecycle metadata, and optional expiry. Types are defined in [src/types/workflow.ts](../src/types/workflow.ts:1).

## Validation

Workflow validation is structural. [src/lib/workflows/validate-definition.ts](../src/lib/workflows/validate-definition.ts:23) requires:

- workflow id and name,
- entity key,
- unique field and state keys,
- supported field types,
- options for choice fields,
- exactly one initial state,
- known transition endpoints,
- valid transition kinds,
- known role references,
- `offlinePolicy.maxOfflineHours >= 1`.

Validation does not prove domain correctness or operational policy compliance.

## Builder

The admin builder lives in [src/app/(routes)/admin/workflows/[id]/page.tsx](<../src/app/(routes)/admin/workflows/[id]/page.tsx:25>). It exposes tabs for fields, flow, roles, settings, and preview.

When a workflow opens, the page tries `/api/workflows/:id/definition`, falls back to IndexedDB, and otherwise creates a draft with two states, one submit transition, three standard roles, and a default offline policy. See [src/app/(routes)/admin/workflows/[id]/page.tsx](<../src/app/(routes)/admin/workflows/[id]/page.tsx:56>).

Builder edits are local-first. `queueWorkflowDefinition()` writes the definition to IndexedDB, enqueues a `workflow_definition` mutation, registers background sync, updates pending count, invalidates caches, and requests pipeline sync in [src/app/(routes)/admin/workflows/[id]/page.tsx](<../src/app/(routes)/admin/workflows/[id]/page.tsx:239>).

The `/admin/workflows/new` page only generates a new id and redirects to the builder in [src/app/(routes)/admin/workflows/new/page.tsx](<../src/app/(routes)/admin/workflows/new/page.tsx:1>).

## Record Lifecycle

Field workers create records from the active workflow. The form chooses the submitted state through [src/lib/workflows/runtime.ts](../src/lib/workflows/runtime.ts:27), saves the record locally, and enqueues a `create` mutation in [src/app/(routes)/field-worker/register/page.tsx](<../src/app/(routes)/field-worker/register/page.tsx:86>).

Record detail edits update fields, increment local version, mark sync pending, and enqueue an update mutation in [src/app/(routes)/field-worker/record/[id]/page.tsx](<../src/app/(routes)/field-worker/record/[id]/page.tsx:162>).

The record detail timeline is synthetic and derived from timestamps/status. It is not a full persisted audit timeline.

## Supervisor Review

Supervisor review is transition-based. The review page loads records, filters transitions by current state and `requiredRoles`, and maps transition kind to status. See [src/app/(routes)/supervisor/review/page.tsx](<../src/app/(routes)/supervisor/review/page.tsx:101>) and [src/app/(routes)/supervisor/review/page.tsx](<../src/app/(routes)/supervisor/review/page.tsx:323>).

Submitting a review writes `supervisor_review_*` fields into the record, updates state/status, and queues an `update` mutation in [src/app/(routes)/supervisor/review/page.tsx](<../src/app/(routes)/supervisor/review/page.tsx:108>).

Current status mapping is simple:

- `reject` => `rejected`
- `approve`, `confirm`, `close` => `approved`
- everything else => `pending`

## Conflict Integration

The sync route compares `base_version` and `base_fields` against current server state and uses the workflow offline policy to auto-merge or create conflicts. See [src/app/api/sync/batch/route.ts](../src/app/api/sync/batch/route.ts:284).

Field-worker and supervisor conflict pages read remote conflicts when online and fall back to local resolution when offline. Offline resolution writes a chosen value, marks local conflicts resolved, enqueues an update mutation, and requests sync in [src/lib/sync/offline-conflict-resolution.ts](../src/lib/sync/offline-conflict-resolution.ts:46).

## Roles And Capabilities

Runtime role access is coarse and ranked in [src/lib/auth/roles.ts](../src/lib/auth/roles.ts:1). Admins inherit supervisor and worker access; supervisors inherit worker access.

Workflow `permissions` arrays are mostly descriptive metadata. Runtime gating is primarily through route role checks and transition `requiredRoles`. Document permissions as product metadata unless the specific route enforces them.

## Known Limitations

- There is no compiled multi-entity workflow manifest.
- The builder save path is local-first and queued; a separate direct publish helper exists in the store but the main builder does not use it.
- Role permissions are not a complete permission engine.
- The record timeline is not backed by a full event-sourced audit log.
