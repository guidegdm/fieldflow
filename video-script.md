# FieldFlow Demo Video Script

Target length: 2:35 to 2:55

Submission requirement reminder: keep the video under 3 minutes, show the working app, explain the problem, explain who it is for, and clearly name Amazon DynamoDB as the AWS database used.

## 0:00-0:20 — Hook and problem

Show: landing page, then a quick cut to demo entry.

Script:

> FieldFlow is for teams that cannot pause when the network disappears. In humanitarian response, health outreach, logistics, agriculture, and field inspections, workers still need to register people, review cases, and manage supplies even with unstable internet. Too often, disconnected teams fall back to paper, spreadsheets, and repeated data entry. FieldFlow keeps the operation moving offline, then synchronizes safely when connectivity returns.

## 0:20-0:40 — What FieldFlow is

Show: demo login / role selection / app shell.

Script:

> FieldFlow is an offline-first B2B platform for creating operational field applications. An organization can define forms, roles, approval stages, permissions, validation rules, and critical actions. Field workers use the generated Progressive Web App on phones, tablets, or laptops.

## 0:40-1:10 — Admin workflow builder

Show: admin dashboard, workflow builder, tabs for fields/flow/roles/preview.

Script:

> Here is the administrator experience. I can create or edit a workflow, define the fields to collect, model the operational states, assign roles, and preview the worker-facing form. The workflow becomes the structure used by the offline app, so the data model and user experience stay connected.

Presenter actions:

- Open `/admin/dashboard`.
- Open or create a workflow.
- Click Fields, Flow, Roles, Preview.
- Show Save/Publish briefly.

## 1:10-1:40 — Offline worker experience

Show: field worker registration page, fill a simple record, save locally.

Script:

> On the worker side, the app continues to work when the network is unreliable. Records, workflow definitions, conflicts, and pending operations are stored locally in IndexedDB. The worker can register a household, capture required information, and save the operation locally. When the network returns, the sync layer sends the pending operations to the server.

Presenter actions:

- Switch to field worker demo user if possible.
- Create a record.
- Show saved locally or pending sync status.

## 1:40-2:10 — Sync, conflicts, and supervisor review

Show: conflict/review/sync pages.

Script:

> FieldFlow does not just overwrite records. Each local change is treated as a traceable operation with base values, workflow version, device, and author. If two devices edit different fields, the system can merge them. If they edit the same field differently, FieldFlow creates a conflict for supervisor review instead of silently losing work.

Presenter actions:

- Open supervisor review or conflicts.
- Show a conflict card or review queue.
- Mention audit trail if visible.

## 2:10-2:35 — AWS architecture and DynamoDB

Show: architecture diagram slide or engineering/snapshot page.

Script:

> The primary backend database is Amazon DynamoDB. FieldFlow stores organizations, users, workflow definitions, record projections, mutation history, device checkpoints, conflicts, inventory state, idempotency receipts, demo sandbox metrics, and audit/ledger entries in DynamoDB. Data is scoped by organization, including demo sandboxes.

> For critical inventory reservation, FieldFlow uses DynamoDB conditional and transactional writes so the last available item cannot be allocated twice. Retried requests use idempotency receipts, so a network retry does not duplicate the business action.

## 2:35-2:55 — Demo sandbox and close

Show: demo page and maybe organization switcher.

Script:

> The public demo is also database-backed. When a visitor enters demo mode, FieldFlow creates an isolated sandbox with its own seeded data and TTL cleanup metadata. That means judges can test the full experience without creating an account, and without affecting another judge's data.

> FieldFlow exists because technology should not stop working precisely where it is needed most.

## What to present on screen

Use this exact order:

1. Landing page: establish product and demo entry.
2. Demo entry: show no-credential access.
3. Admin dashboard: show organization-level product.
4. Workflow builder: fields, flow, roles, preview.
5. Field worker registration: create or save a record.
6. Sync/status or conflict page: show offline-first behavior.
7. Supervisor/inventory: show review or critical reservation.
8. Architecture diagram: name DynamoDB and Vercel clearly.
9. Demo sandbox explanation: each visitor gets an isolated DynamoDB-backed workspace.

## Lines to make sure you say

- "FieldFlow uses Amazon DynamoDB as the primary backend database."
- "The frontend is deployed on Vercel."
- "The app is offline-first and stores local work in IndexedDB."
- "The demo is not static data; it creates isolated DynamoDB-backed sandboxes."
- "Critical inventory uses idempotency and DynamoDB conditional or transactional writes."

## Avoid saying

- Do not mention Aurora DSQL unless it is actually wired in the running app.
- Do not spend time on internal implementation details that are not visible.
- Do not let the video go over 3 minutes.

Fatima
fatima@demo.ff
Field Agent

Dr. Amara
dr-amara@demo.ff
Supervisor

Preparing offline demo...
celine@demo.ff