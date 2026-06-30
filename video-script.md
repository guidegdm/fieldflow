# FieldFlow Demo Video Script

Target length: 2:45 to 2:58.

Goal: show a real SaaS product, not a static demo. The video must clearly say that the frontend is deployed on Vercel and the primary backend database is Amazon DynamoDB.

## One-Line Positioning

FieldFlow is an offline-first operations platform for teams that still need to register people, collect evidence, review work, and manage critical supplies when the network disappears.

## Screen Setup Before Recording

Open these tabs before starting:

1. `https://fieldflow-tau.vercel.app/`
2. `https://fieldflow-tau.vercel.app/auth/signup`
3. `https://fieldflow-tau.vercel.app/auth/signin`
4. `https://fieldflow-tau.vercel.app/demo`
5. Runtime architecture diagram slide.
6. Optional: email inboxes for the two invited users.

Use three browser profiles if possible:

1. Admin account: created live during the recording.
2. Supervisor account: pre-existing or invited during the recording.
3. Field worker account: pre-existing or invited during the recording.

## 0:00-0:18 - Hook

Show: landing page, then scroll/hover very briefly.

Say:

> FieldFlow is built for teams whose work cannot wait for a perfect internet connection. In humanitarian response, health outreach, logistics, agriculture, and field inspections, people still need to collect data, review cases, and protect limited supplies even when the network disappears.

## 0:18-0:35 - Product Summary

Show: landing page call to action, then sign-up page.

Say:

> FieldFlow turns operational workflows into offline-first web apps. An organization can define forms, roles, approval stages, permissions, and critical actions, then field workers use the generated app on phones, tablets, or laptops.

## 0:35-0:58 - Live SaaS Signup And Workspace

Show: `/auth/signup`.

Actions:

1. Create a new admin account.
2. Enter workspace name and sector.
3. Show email verification code step.
4. If recording time is tight, cut after code entry and show the admin dashboard.

Say:

> This is a real account flow backed by Amazon Cognito. Password signups verify the inbox with an email code before the workspace is activated. Google sign-in is also supported, and invited users are linked into the right workspace by their verified email.

## 0:58-1:18 - Invite Real Users

Show: `/admin/users`.

Actions:

1. Invite one supervisor.
2. Invite one field worker.
3. Mention that Cognito sends the invite email.
4. If possible, quickly show one inbox and then sign in with Google using the invited email.

Say:

> From the admin dashboard, I can invite field agents and supervisors. If the Cognito user does not exist yet, FieldFlow creates the user and sends an invite. If that person later signs in with Google using the same email, the app resolves the invitation and places them into this workspace automatically.

## 1:18-1:45 - AI Workflow Generation

Show: `/admin/workflows/new` or an existing workflow builder.

Actions:

1. Open the AI assistant.
2. Prompt example:

```text
Create an aid distribution workflow where field agents register households, supervisors verify eligibility, inventory is reserved only once, and final distribution is confirmed in the field.
```

3. Show generated fields.
4. Click Flow.
5. Click Roles.
6. Click Preview.
7. Save or publish.

Say:

> The workflow builder lets an administrator design the operation: fields, states, transitions, roles, and preview. The AI assistant can draft the workflow, but the human admin reviews and publishes it. That keeps AI useful without letting it make operational decisions.

## 1:45-2:08 - Field Worker Experience

Show: `/field-worker/register`.

Actions:

1. Use admin, supervisor, or field worker. Admin and supervisor can also perform field work.
2. Fill a short registration.
3. Add a photo from gallery if needed.
4. Save the record.
5. Show local save or pending sync indicator.

Say:

> On the field side, workers can register a household, capture evidence, and save the operation locally. FieldFlow stores the app state and field work in the browser so the user can continue even when connectivity is unreliable.

## 2:08-2:30 - Offline Sync And Conflict Review

Show: phone or second browser if possible.

Actions:

1. Open an existing record on one device.
2. Go offline.
3. Edit a field and save locally.
4. Edit the same record elsewhere while online.
5. Reconnect and sync.
6. Show `/supervisor/conflicts`.

Say:

> FieldFlow does not blindly overwrite records. Local changes carry base values, device information, workflow version, and author. If two devices edit safely, the system can merge. If they disagree on the same field, FieldFlow creates a conflict for supervisor review instead of losing work.

## 2:30-2:43 - Inventory And DynamoDB Correctness

Show: `/supervisor/inventory`.

Actions:

1. Show available stock.
2. Reserve an item if data allows.
3. Mention idempotency and conditional writes.

Say:

> For critical inventory, FieldFlow uses DynamoDB conditional and transactional writes with idempotency receipts. If a request retries because of a bad network, the business action is not duplicated, and the last available item cannot be promised twice.

## 2:43-2:55 - Demo Sandbox

Show: `/demo`.

Actions:

1. Show demo roles.
2. Enter as admin or supervisor.
3. Mention isolated sandbox and TTL cleanup.

Say:

> Judges can also try the full product without creating an account. The demo is not static data. It creates an isolated DynamoDB-backed sandbox with private seeded records and TTL cleanup, so one visitor cannot break another visitor's demo.

## 2:55-2:59 - Architecture Close

Show: runtime architecture diagram.

Say:

> The frontend is deployed on Vercel. Amazon DynamoDB is the primary backend database for workspaces, users, workflows, records, sync mutations, conflicts, inventory, audit events, and demo sandboxes. FieldFlow exists because field technology should keep working where it is needed most.

## Required Lines To Say Clearly

- "The frontend is deployed on Vercel."
- "Amazon DynamoDB is the primary backend database."
- "The app is offline-first and stores local work in IndexedDB."
- "The public demo creates isolated DynamoDB-backed sandboxes."
- "Critical inventory uses idempotency and DynamoDB conditional or transactional writes."
- "Cognito handles email verification, invitations, Google sign-in, and password reset."

## Live Routes Checklist

Use these routes during the recording:

1. Landing: `https://fieldflow-tau.vercel.app/`
2. Signup: `https://fieldflow-tau.vercel.app/auth/signup`
3. Signin: `https://fieldflow-tau.vercel.app/auth/signin`
4. Reset password: `https://fieldflow-tau.vercel.app/auth/reset-password`
5. Admin dashboard: `https://fieldflow-tau.vercel.app/admin/dashboard`
6. Users and invites: `https://fieldflow-tau.vercel.app/admin/users`
7. Workflow list: `https://fieldflow-tau.vercel.app/admin/workflows`
8. New workflow: `https://fieldflow-tau.vercel.app/admin/workflows/new`
9. Field registration: `https://fieldflow-tau.vercel.app/field-worker/register`
10. Field search: `https://fieldflow-tau.vercel.app/field-worker/search`
11. Supervisor review: `https://fieldflow-tau.vercel.app/supervisor/review`
12. Conflicts: `https://fieldflow-tau.vercel.app/supervisor/conflicts`
13. Inventory: `https://fieldflow-tau.vercel.app/supervisor/inventory`
14. Demo sandbox: `https://fieldflow-tau.vercel.app/demo`

## Demo Account Notes

Use these only for the public demo flow:

- `celine@demo.ff` - Administrator
- `dr-amara@demo.ff` - Supervisor
- `jean-pierre@demo.ff` - Field Agent
- `fatima@demo.ff` - Field Agent

## If Time Runs Short

Cut in this order:

1. Password reset mention only, do not show the page.
2. Email inbox view.
3. Inventory reservation click.
4. Detailed role tab in workflow builder.

Do not cut:

1. DynamoDB statement.
2. Vercel statement.
3. Offline/local save.
4. Conflict handling.
5. Demo sandbox isolation.

## Avoid Saying

- Do not mention Aurora DSQL.
- Do not say the demo uses static data.
- Do not spend time explaining implementation internals that are not visible.
- Do not go over three minutes.
