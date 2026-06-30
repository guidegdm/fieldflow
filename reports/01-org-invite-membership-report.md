# FieldFlow Org, Invite, Membership, Workspace Access, Persistence, and Workflow Inheritance Audit

## Executive Summary

The real implementation supports organization creation for confirmed Cognito signup and Google setup, stores organization/user profile rows, resolves login membership by email, scopes core workflow and record APIs by `user.orgId`, and lets the client switch among `orgs` stored in the signed session. That is enough for a happy-path existing user with a completed Cognito account to log in and inherit org-scoped workflows and records.

The invitation and membership model is not complete or safe enough to claim end-to-end org invitations. There is no invitation entity, no accept-invite route, no durable invitation token, and no first-login password challenge handling for users created with `AdminCreateUserCommand`. A newly invited non-existing Cognito user will likely receive a Cognito temporary-password invite, hit `NEW_PASSWORD_REQUIRED`, and be rejected because only OTP/MFA challenges are supported. Existing users can be linked by email, but the code mutates Cognito `custom:role` globally and later API authorization can prefer that global role over the per-org membership role.

The DynamoDB adapter persists the right entity families, but most access patterns are table scans, membership writes are not transactional with org creation or Cognito operations, mutation idempotency is check-then-write rather than atomic, and server sequence assignment is process-local. Those choices create consistency and concurrency risks in a serverless deployment.

## Flow Map

### 1. Admin Creates Workspace/Org

Email/password signup is split into two routes. `/api/auth/signup` validates `email`, `password`, `name`, `orgName`, and `orgSector`, but only calls Cognito signup and returns `requiresConfirmation`; it does not persist the org or profile at this stage (`src/app/api/auth/signup/route.ts:37`, `src/app/api/auth/signup/route.ts:40`, `src/app/api/auth/signup/route.ts:42`, `src/app/api/auth/signup/route.ts:46`, `src/app/api/auth/signup/route.ts:64`). The `pendingOrgId` generated in signup is unused (`src/app/api/auth/signup/route.ts:42`).

The actual email/password org creation happens after verification. `/api/auth/confirm-signup` confirms Cognito, generates a new org id, writes an org row, writes the initial admin profile, updates Cognito attributes, signs in, and returns a session (`src/app/api/auth/confirm-signup/route.ts:52`, `src/app/api/auth/confirm-signup/route.ts:64`, `src/app/api/auth/confirm-signup/route.ts:69`, `src/app/api/auth/confirm-signup/route.ts:70`, `src/app/api/auth/confirm-signup/route.ts:81`, `src/app/api/auth/confirm-signup/route.ts:95`, `src/app/api/auth/confirm-signup/route.ts:103`, `src/app/api/auth/confirm-signup/route.ts:118`).

Google OAuth setup creates a workspace only when callback finds no existing profile. The callback redirects unknown Google users to `/auth/setup` with a pending setup cookie (`src/app/api/auth/callback/route.ts:81`, `src/app/api/auth/callback/route.ts:87`, `src/app/api/auth/callback/route.ts:100`, `src/app/api/auth/callback/route.ts:106`, `src/app/api/auth/callback/route.ts:107`). `/api/auth/setup` then writes the org, writes the admin profile, and creates a signed session (`src/app/api/auth/setup/route.ts:52`, `src/app/api/auth/setup/route.ts:58`, `src/app/api/auth/setup/route.ts:66`, `src/app/api/auth/setup/route.ts:96`, `src/app/api/auth/setup/route.ts:120`).

### 2. Admin Invites Existing User

The admin users API allows only `org_admin` callers (`src/app/api/admin/users/route.ts:42`, `src/app/api/admin/users/route.ts:44`). It validates email/role/name (`src/app/api/admin/users/route.ts:16`), looks up the Cognito user by email (`src/app/api/admin/users/route.ts:62`), updates the Cognito user's `name` and `custom:role` globally (`src/app/api/admin/users/route.ts:63`, `src/app/api/admin/users/route.ts:66`), and then writes a user profile row in the caller's org (`src/app/api/admin/users/route.ts:110`, `src/app/api/admin/users/route.ts:116`, `src/app/api/admin/users/route.ts:125`).

On the next login, `/api/auth/login` verifies Cognito tokens and calls `resolveWorkspaceMembership` (`src/app/api/auth/login/route.ts:110`, `src/app/api/auth/login/route.ts:112`). Membership resolution scans profiles by email, filters active org profiles, sorts by `createdAt`, chooses the current org profile or newest profile, and returns all org ids for the user (`src/lib/auth/workspace-membership.ts:29`, `src/lib/auth/workspace-membership.ts:30`, `src/lib/auth/workspace-membership.ts:31`, `src/lib/auth/workspace-membership.ts:32`, `src/lib/auth/workspace-membership.ts:36`, `src/lib/auth/workspace-membership.ts:37`, `src/lib/auth/workspace-membership.ts:42`, `src/lib/auth/workspace-membership.ts:45`).

### 3. Admin Invites Non-Existing User

For a missing Cognito user, the admin API calls `AdminCreateUserCommand` and then persists the org user profile (`src/app/api/admin/users/route.ts:88`, `src/app/api/admin/users/route.ts:90`, `src/app/api/admin/users/route.ts:101`, `src/app/api/admin/users/route.ts:110`, `src/app/api/admin/users/route.ts:125`). There is no separate accept-invite route, invitation token, or invitation status transition. The invite is represented only as profile fields such as `invited`, `invitedBy`, and `delivery` (`src/app/api/admin/users/route.ts:118`, `src/app/api/admin/users/route.ts:119`, `src/app/api/admin/users/route.ts:120`).

The login route only supports Cognito `EMAIL_OTP`, `SMS_MFA`, and `SOFTWARE_TOKEN_MFA` challenges (`src/app/api/auth/login/route.ts:93`, `src/app/api/auth/login/route.ts:94`, `src/app/api/auth/login/route.ts:96`, `src/app/api/auth/login/route.ts:102`). The OTP route only responds to those same challenge names (`src/app/api/auth/otp/route.ts:11`, `src/app/api/auth/otp/route.ts:15`, `src/app/api/auth/otp/route.ts:43`). There is no `NEW_PASSWORD_REQUIRED` handler in the codebase; the only password challenge references are signup/login auth calls and the unsupported challenge branch (`src/app/api/auth/login/route.ts:88`, `src/app/api/auth/login/route.ts:102`).

### 4. User Accepts/Logs In and Belongs to Org

There is no app-level invitation acceptance. Existing users "accept" membership implicitly by logging in after a profile row exists. Login rejects users without resolved membership (`src/app/api/auth/login/route.ts:112`, `src/app/api/auth/login/route.ts:113`), returns the selected org/orgs, and sets access, refresh, and signed session cookies (`src/app/api/auth/login/route.ts:115`, `src/app/api/auth/login/route.ts:117`, `src/app/api/auth/login/route.ts:122`, `src/app/api/auth/login/route.ts:123`, `src/app/api/auth/login/route.ts:124`).

Session reads do not re-check DynamoDB membership. `/api/auth/session` trusts `getAuthUser`, returns the org embedded in the auth context, and falls back to the signed `orgs` list (`src/app/api/auth/session/route.ts:5`, `src/app/api/auth/session/route.ts:8`, `src/app/api/auth/session/route.ts:9`, `src/app/api/auth/session/route.ts:19`). `/api/auth/org` lets a user switch only among org ids present in the session's `orgs` array (`src/app/api/auth/org/route.ts:16`, `src/app/api/auth/org/route.ts:17`, `src/app/api/auth/org/route.ts:18`, `src/app/api/auth/org/route.ts:20`, `src/app/api/auth/org/route.ts:34`).

### 5. User Sees Inherited Workflows and Records

Core APIs scope workflows and records by the authenticated `user.orgId`. `/api/workflows` lists workflows and record counts for `user.orgId` (`src/app/api/workflows/route.ts:6`, `src/app/api/workflows/route.ts:10`, `src/app/api/workflows/route.ts:11`, `src/app/api/workflows/route.ts:12`). Workflow definition reads and writes also force `orgId` to the current user org (`src/app/api/workflows/[id]/definition/route.ts:15`, `src/app/api/workflows/[id]/definition/route.ts:36`, `src/app/api/workflows/[id]/definition/route.ts:65`). Record reads first verify the workflow belongs to the current org, then list records by workflow and org (`src/app/api/workflows/[id]/records/route.ts:14`, `src/app/api/workflows/[id]/records/route.ts:17`).

The frontend workflow context uses `user.orgId`, loads published workflows into `byOrgId`, and selects the active workflow per org (`src/hooks/useWorkflowContext.ts:13`, `src/hooks/useWorkflowContext.ts:14`, `src/hooks/useWorkflowContext.ts:21`, `src/hooks/useWorkflowContext.ts:36`). The workflow list store filters to published workflows (`src/stores/workflowListStore.ts:12`, `src/stores/workflowListStore.ts:14`) and fetches `/api/workflows` with credentials (`src/stores/workflowListStore.ts:47`, `src/stores/workflowListStore.ts:49`, `src/stores/workflowListStore.ts:51`). Field worker home reads local org records first, then fetches `/api/workflows/{id}/records` for the active workflow(s) (`src/app/(routes)/field-worker/home/page.tsx:51`, `src/app/(routes)/field-worker/home/page.tsx:55`, `src/app/(routes)/field-worker/home/page.tsx:57`, `src/app/(routes)/field-worker/home/page.tsx:62`).

## Exact Bugs and Risks

### Critical: New Invited Users Cannot Complete First Login

`AdminCreateUserCommand` invites a missing Cognito user (`src/app/api/admin/users/route.ts:90`), which normally creates a user in a temporary password / `FORCE_CHANGE_PASSWORD` state. The app explicitly detects `FORCE_CHANGE_PASSWORD` only to resend the invite (`src/app/api/admin/users/route.ts:71`, `src/app/api/admin/users/route.ts:72`), but login supports only OTP/MFA challenges and rejects anything else (`src/app/api/auth/login/route.ts:93`, `src/app/api/auth/login/route.ts:94`, `src/app/api/auth/login/route.ts:102`). There is no route that responds to `NEW_PASSWORD_REQUIRED`. Result: non-existing invited users can receive a Cognito email and have a FieldFlow profile row, but likely cannot establish a normal app session.

### Critical: Per-Org Role Can Be Overridden by Global Cognito Role During API Auth

Login resolves a per-org role from the membership profile (`src/lib/auth/workspace-membership.ts:36`, `src/lib/auth/workspace-membership.ts:42`, `src/lib/auth/workspace-membership.ts:48`). However, `getAuthUser` validates `ff_access` first when present (`src/lib/auth/middleware.ts:224`, `src/lib/auth/middleware.ts:226`, `src/lib/auth/middleware.ts:227`), and `verifyCognitoJWT` uses Cognito `custom:role` before the signed session context role (`src/lib/auth/middleware.ts:107`). The admin invite path mutates that Cognito `custom:role` globally for existing users (`src/app/api/admin/users/route.ts:63`, `src/app/api/admin/users/route.ts:66`, `src/app/api/admin/users/route.ts:68`). Result: a user with multiple org memberships can be authorized as the wrong role in API routes such as admin users and workflow publish, which check only `user.role` (`src/app/api/admin/users/route.ts:44`, `src/app/api/workflows/[id]/publish/route.ts:11`).

### High: There Is No Real Invitation Acceptance Model

Invitation state is only a profile row with `invited: true` and delivery metadata (`src/app/api/admin/users/route.ts:118`, `src/app/api/admin/users/route.ts:120`). There is no invitation table item, no token, no expiration, no accept route, and no accepted timestamp. Login simply resolves active profiles by email (`src/lib/auth/workspace-membership.ts:29`, `src/lib/auth/workspace-membership.ts:31`). Result: invited existing users are members immediately, and invited non-existing users are treated as members before they have accepted or proven control through the app.

### High: Cognito and Store Writes Are Not Atomic

Admin invite writes Cognito first, catches Cognito failures, and still persists a local profile (`src/app/api/admin/users/route.ts:59`, `src/app/api/admin/users/route.ts:103`, `src/app/api/admin/users/route.ts:106`, `src/app/api/admin/users/route.ts:125`). If Cognito fails for a non-existing user, the UI still gets a created profile, but the user cannot authenticate. Conversely, if Cognito succeeds and `putUserProfileAsync` fails, the user can receive an invite without a membership row (`src/app/api/admin/users/route.ts:90`, `src/app/api/admin/users/route.ts:125`).

Org creation is also two independent writes: org row then admin profile (`src/app/api/auth/confirm-signup/route.ts:69`, `src/app/api/auth/confirm-signup/route.ts:70`; `src/app/api/auth/setup/route.ts:58`, `src/app/api/auth/setup/route.ts:66`). The DynamoDB adapter implements those as separate `PutCommand`s (`src/lib/api/dynamo-store.ts:566`, `src/lib/api/dynamo-store.ts:570`, `src/lib/api/dynamo-store.ts:582`, `src/lib/api/dynamo-store.ts:587`). Result: partial org/profile state is possible.

### High: Sessions Do Not Revalidate Active Membership

`getAuthUser` verifies cookies/tokens but does not look up the current profile row or check `active` (`src/lib/auth/middleware.ts:215`, `src/lib/auth/middleware.ts:224`, `src/lib/auth/middleware.ts:230`, `src/lib/auth/middleware.ts:254`). `/api/auth/org` trusts the `orgs` already embedded in the session (`src/app/api/auth/org/route.ts:16`, `src/app/api/auth/org/route.ts:17`). Result: membership revocation, role changes, or deactivation do not take effect for existing sessions until the signed session/access-token context changes or expires.

### Medium: Admin Users UI Suggests Role/Active Editing but Does Not Persist It

The users page lets an admin change role and active status in local React state only (`src/app/(routes)/admin/users/page.tsx:86`, `src/app/(routes)/admin/users/page.tsx:87`, `src/app/(routes)/admin/users/page.tsx:91`, `src/app/(routes)/admin/users/page.tsx:92`). The role select and active/deactivate button call those local handlers (`src/app/(routes)/admin/users/page.tsx:191`, `src/app/(routes)/admin/users/page.tsx:193`, `src/app/(routes)/admin/users/page.tsx:224`, `src/app/(routes)/admin/users/page.tsx:227`). There is no `PATCH`/`DELETE` route in the admin users route; it only exports `GET` and `POST` (`src/app/api/admin/users/route.ts:32`, `src/app/api/admin/users/route.ts:41`). Result: visible user management controls do not change backend membership.

### Medium: Multi-Org Offline Warmup Cannot Fetch Other Orgs Reliably

The offline warmup code iterates all session orgs and passes `x-fieldflow-org-id` for each fetch (`src/lib/demo/offline-demo-cache.ts:377`, `src/lib/demo/offline-demo-cache.ts:384`, `src/lib/demo/offline-demo-cache.ts:385`, `src/lib/demo/offline-demo-cache.ts:386`, `src/lib/demo/offline-demo-cache.ts:277`, `src/lib/demo/offline-demo-cache.ts:284`). The Next middleware overwrites `x-fieldflow-org-id` from the signed session cookie org id (`middleware.ts:48`, `middleware.ts:49`, `middleware.ts:52`, `middleware.ts:53`). Result: background hydration for non-current orgs can fetch the current org repeatedly unless the user switches org and receives a new session cookie.

### Medium: Supervisor Offline Fallback Can Read All Local Records

Supervisor dashboard online reads org-scoped API records (`src/app/(routes)/supervisor/dashboard/page.tsx:43`), but offline fallback uses `db.getAllRecords()` without filtering by current `user.orgId` (`src/app/(routes)/supervisor/dashboard/page.tsx:47`, `src/app/(routes)/supervisor/dashboard/page.tsx:48`, `src/app/(routes)/supervisor/dashboard/page.tsx:53`, `src/app/(routes)/supervisor/dashboard/page.tsx:54`). The IndexedDB helper has org-scoped methods, but this page does not use them (`src/lib/db/indexeddb.ts:127`, `src/lib/db/indexeddb.ts:130`). Result: a browser that has cached multiple orgs can show cross-org records in offline supervisor views.

### Medium: IndexedDB Keys Are Not Org-Scoped

Local `records` and `workflows` object stores use `id` as keyPath (`src/lib/db/indexeddb.ts:38`, `src/lib/db/indexeddb.ts:39`). Replace operations filter by `orgId` before deleting, but put records/workflows under raw ids (`src/lib/db/indexeddb.ts:137`, `src/lib/db/indexeddb.ts:138`, `src/lib/db/indexeddb.ts:178`, `src/lib/db/indexeddb.ts:179`). Demo/local workflows commonly use the same id across orgs, such as `wf-1` (`src/lib/demo/offline-demo-cache.ts:53`). Result: one org's workflow/record can overwrite another org's local item if ids collide.

## DynamoDB Persistence, Concurrency, and Consistency Risks

1. Most org-scoped reads are scans, not key queries. Workflows, records, users, membership-by-email, mutations, and sequence reads use `ScanCommand` filters (`src/lib/api/dynamo-store.ts:246`, `src/lib/api/dynamo-store.ts:247`, `src/lib/api/dynamo-store.ts:254`, `src/lib/api/dynamo-store.ts:255`, `src/lib/api/dynamo-store.ts:278`, `src/lib/api/dynamo-store.ts:279`, `src/lib/api/dynamo-store.ts:594`, `src/lib/api/dynamo-store.ts:595`, `src/lib/api/dynamo-store.ts:611`, `src/lib/api/dynamo-store.ts:612`, `src/lib/api/dynamo-store.ts:549`, `src/lib/api/dynamo-store.ts:550`, `src/lib/api/dynamo-store.ts:557`, `src/lib/api/dynamo-store.ts:558`). This is costly and eventually fragile as org count and record volume grow.

2. Mutation idempotency is check-then-write. Sync checks `hasMutationForOrg` before applying an operation (`src/app/api/sync/batch/route.ts:117`, `src/app/api/sync/batch/route.ts:118`), then writes records and mutations later (`src/app/api/sync/batch/route.ts:169`, `src/app/api/sync/batch/route.ts:170`, `src/app/api/sync/batch/route.ts:304`, `src/app/api/sync/batch/route.ts:305`). Dynamo mutation writes are unconditional `PutCommand`s (`src/lib/api/dynamo-store.ts:535`, `src/lib/api/dynamo-store.ts:537`, `src/lib/api/dynamo-store.ts:539`). Concurrent duplicate requests can both pass the check.

3. Server sequence assignment is process-local. `storeMutationForOrg` increments an in-memory `seq` and writes that value to DynamoDB (`src/lib/api/in-memory-store.ts:97`, `src/lib/api/in-memory-store.ts:98`, `src/lib/api/in-memory-store.ts:99`, `src/lib/api/in-memory-store.ts:100`). The store is a global object per server process (`src/lib/api/in-memory-store.ts:296`, `src/lib/api/in-memory-store.ts:299`, `src/lib/api/in-memory-store.ts:300`). In serverless or multi-instance runtime, sequences can duplicate or move backward between instances.

4. User profile writes are blind overwrites. Dynamo user profile persistence uses `PutCommand` with no condition or version check (`src/lib/api/dynamo-store.ts:582`, `src/lib/api/dynamo-store.ts:586`, `src/lib/api/dynamo-store.ts:587`, `src/lib/api/dynamo-store.ts:589`). Re-invites or concurrent role changes can silently replace membership fields.

5. Org and initial admin profile creation is not a Dynamo transaction. The app writes org and profile independently (`src/app/api/auth/confirm-signup/route.ts:69`, `src/app/api/auth/confirm-signup/route.ts:70`; `src/app/api/auth/setup/route.ts:58`, `src/app/api/auth/setup/route.ts:66`), and the store adapter exposes only independent put methods for those entities (`src/lib/api/dynamo-store.ts:566`, `src/lib/api/dynamo-store.ts:582`).

6. Table key compatibility fallbacks can hide schema mistakes by scanning. If key schema detection fails, `sendGet` falls back through alternate shapes and then scans by `pk`/`sk` (`src/lib/api/dynamo-store.ts:89`, `src/lib/api/dynamo-store.ts:101`, `src/lib/api/dynamo-store.ts:123`, `src/lib/api/dynamo-store.ts:124`, `src/lib/api/dynamo-store.ts:125`). That can make production behavior depend on broad scans rather than expected key access.

## False or Overstated Claims

1. "Admin dashboard, workflow builder, users, settings" is overstated for user management. The README claims a users area (`README.md:46`), but the users page can only persist invites; role changes and deactivation are local-only UI state (`src/app/(routes)/admin/users/page.tsx:86`, `src/app/(routes)/admin/users/page.tsx:91`).

2. "Cognito-backed real authentication" is true for signup/login, but incomplete for admin-created invitees. The README claims Cognito-backed real authentication (`README.md:47`), while the login challenge handling omits `NEW_PASSWORD_REQUIRED` for users created through `AdminCreateUserCommand` (`src/app/api/admin/users/route.ts:90`, `src/app/api/auth/login/route.ts:93`, `src/app/api/auth/login/route.ts:102`).

3. "Tenant boundaries" is only partially true offline. The README says the API layer handles tenant boundaries (`README.md:58`) and that the backend keeps every tenant isolated (`README.md:66`), but local IndexedDB keys are not org-scoped (`src/lib/db/indexeddb.ts:38`, `src/lib/db/indexeddb.ts:39`), and supervisor offline fallback can read all local records (`src/app/(routes)/supervisor/dashboard/page.tsx:47`, `src/app/(routes)/supervisor/dashboard/page.tsx:53`).

4. "DynamoDB-backed org, workflow, record, mutation, conflict, inventory, audit, and demo sandbox storage" is directionally true, but "primary backend" should not imply robust access patterns. Many production reads are implemented as scans (`src/lib/api/dynamo-store.ts:160`, `src/lib/api/dynamo-store.ts:247`, `src/lib/api/dynamo-store.ts:279`, `src/lib/api/dynamo-store.ts:595`, `src/lib/api/dynamo-store.ts:611`) and sync sequencing depends on in-memory process state (`src/lib/api/in-memory-store.ts:97`, `src/lib/api/in-memory-store.ts:100`).

## Recommendations

1. Add a real invitation model: store invitation rows with org id, email, role, inviter, token hash, expiration, accepted/revoked timestamps, and delivery status. Do not mark a user as an active member until acceptance is complete.

2. Support Cognito `NEW_PASSWORD_REQUIRED` or replace `AdminCreateUserCommand` with a flow the app can finish. Add a `/api/auth/new-password` route using Cognito challenge session state, or invite users to self-signup and claim a pending invitation after email verification.

3. Stop storing per-org authorization in Cognito `custom:role`. Keep Cognito for identity and use DynamoDB membership profiles for org roles. In `verifyCognitoJWT`, prefer the signed membership context role when the org came from the signed context, or re-resolve membership on each API request that mutates data.

4. Revalidate membership for sensitive APIs. Admin APIs, workflow publish/write APIs, sync state transitions, and org switching should load the active profile for `email + orgId`, require `active !== false`, and use that row's role.

5. Make org/profile creation and invitation acceptance transactional. Use `TransactWriteCommand` for org plus initial admin profile, and for invitation acceptance plus membership creation. Use `ConditionExpression` to avoid duplicate org ids, duplicate invitation tokens, and blind membership overwrites.

6. Make sync idempotency atomic. Use a DynamoDB transaction that conditionally creates the mutation receipt before applying record changes, or write a conditional idempotency item first and make operation application dependent on that condition.

7. Replace process-local sync sequence with a durable per-org counter or stream-compatible ordering. If strict per-org ordering is required, update a counter item conditionally in DynamoDB; otherwise return cursor semantics that do not depend on monotonic process memory.

8. Add GSIs or key designs for required reads: `USER_EMAIL#email` membership lookup, `ORG#id` workflow/record lists, and `ORG#id#MUTATION` sequence/cursor reads. Avoid table scans in normal login, sync, and dashboard paths.

9. Scope IndexedDB keys by org. Use composite ids such as `${orgId}#${id}` for records/workflows/conflicts or add indexes and migration logic. Update all local lookups to require `orgId`.

10. Fix multi-org offline hydration. Either call `/api/auth/org` before warming each org or accept a signed per-request org switch header/token that middleware validates against session `orgs` instead of overwriting with the current cookie org.

11. Add tests for the audited flow: new signup creates org/profile, existing-user invite resolves membership, non-existing-user invite completes first login, org switching uses per-org role, deactivated users lose access, invited users inherit published workflows/records, duplicate sync operations are idempotent, and offline supervisor views stay org-scoped.
