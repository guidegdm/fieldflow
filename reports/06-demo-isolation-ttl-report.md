# Demo Isolation and TTL Audit

Source diagram: `docs/docs/diagrams/mermaid/06-demo-isolation-ttl.mmd`

## Executive Summary

The diagram is broadly accurate about the online happy path: `/demo` posts a demo email plus selected org to `/api/auth/login`, the API creates or reuses a signed `ff_demo_install` cookie, seeds install-scoped demo orgs in the store, sets a signed `ff_session`, and returns all demo workspaces/accounts for browser-local offline hydration.

The strongest implementation gaps are around TTL completeness and local multi-org isolation. Seeded baseline entities mostly get `expiresAt`, but user-created records, sync mutations, conflict records, and some audit events do not consistently inherit the sandbox expiry. Reopened installs can also refresh org/workflow/user/device TTL while leaving existing records and inventory with their original expiry. Locally, IndexedDB keys workflows by `id` only, while every demo org uses the same workflow IDs, so hydrating all demo orgs can overwrite offline workflow data across orgs.

There is also a security-sensitive configuration risk: if `SESSION_SECRET` is not set, demo/session cookies are HMAC-signed with the Cognito client id fallback, including a hardcoded public value. In that configuration, the diagram's "signed token" control should not be treated as a strong boundary.

## Diagram Claim Trace

| Diagram claim | Status | Evidence |
| --- | --- | --- |
| Demo page posts demo email and selected org to `/api/auth/login`. | Implemented. | Diagram lines 3-4. UI sends `{ email, demoOrgKey }` with credentials at `src/app/(public)/demo/page.tsx:56-66`. Login schema accepts `demoOrgKey` at `src/app/api/auth/login/route.ts:14-18`. |
| `ff_demo_install` is created/reused as a signed install token. | Implemented with caveat. | Cookie branch in diagram lines 5-7. `getOrCreateDemoInstall` verifies an existing signed envelope and otherwise creates a random UUID install id at `src/lib/auth/middleware.ts:201-212`; cookie is `HttpOnly; Secure; SameSite=Lax; Max-Age=7 days` at `src/lib/auth/middleware.ts:269-270`. Caveat: weak fallback secret, see Finding 1. |
| Demo seeding creates three install-scoped orgs. | Implemented. | Diagram lines 12-15. `seedIsolatedDemoOrg` loops through all `DEMO_ORGS` at `src/lib/demo/seed-demo-org.ts:312-346`; org ids are `demo-${installId.slice(0, 12)}-${orgKey.toLowerCase()}` at `src/lib/demo/seed-demo-org.ts:8-17`. |
| Users are install-scoped role and org membership copies. | Implemented. | Diagram line 16. Membership templates are in `src/types/auth.ts:63-74`; user ids and device ids are suffixed with install and org key at `src/lib/demo/seed-demo-org.ts:348-379`. |
| Workflows, seed records, and inventory are copied. | Implemented for baseline seed. | Diagram lines 17-19. Workflows are written at `src/lib/demo/seed-demo-org.ts:328-331`; seed records and inventory are written only if no existing `wf-1` records exist at `src/lib/demo/seed-demo-org.ts:333-345`. |
| Metrics include seed counts, selected org, user, install, and `expiresAt`. | Implemented. | Diagram line 21. Metric write includes `installId`, `orgId`, `selectedOrgKey`, `userId`, `seeded`, spread `seedCounts`, `expiresAt`, and timestamp at `src/lib/demo/seed-demo-org.ts:441-450`; DynamoDB key is `DEMO#...#SANDBOX#...` at `src/lib/api/dynamo-store.ts:221-222` and write at `src/lib/api/dynamo-store.ts:638-651`. |
| Login response includes selected user context, all demo workspaces, and all demo accounts. | Implemented. | Diagram lines 24-27. Response includes `user`, selected `org`, `orgs`, `offlineWorkspaces`, and `offlineAccounts` at `src/app/api/auth/login/route.ts:57-77`; offline workspaces/accounts are assembled at `src/lib/demo/seed-demo-org.ts:393-417`. |
| Browser-local install uses IndexedDB and localStorage. | Implemented with bugs. | Diagram lines 26-27. Login hydrates IndexedDB and persists localStorage at `src/app/(public)/demo/page.tsx:70-80`; localStorage key is `fieldflow-demo-sandbox` at `src/lib/demo/offline-demo-cache.ts:10` and persisted at `src/lib/demo/offline-demo-cache.ts:315-318`. See Findings 4 and 8. |
| App uses same APIs as real users with org-scoped reads/writes. | Mostly implemented. | Diagram line 28. API auth pulls org context from signed session at `middleware.ts:48-54` and `src/lib/auth/middleware.ts:215-254`; DynamoDB pk helpers are org-scoped at `src/lib/api/dynamo-store.ts:185-223`. |
| Visitor mutations write only under `ORG#demo...` DynamoDB keys. | Mostly implemented for DynamoDB writes, incomplete for TTL. | Diagram lines 31-32. Records use `ORG#${orgId}#RECORD#...` at `src/lib/api/dynamo-store.ts:185-187` and writes at `src/lib/api/dynamo-store.ts:225-233`; mutations use `ORG#${orgId}#MUTATION#...` at `src/lib/api/dynamo-store.ts:213-215` and writes at `src/lib/api/dynamo-store.ts:535-540`. |
| S3 evidence is under demo org prefixes. | Partially implemented. | Diagram lines 20 and 33. Presign builds `orgs/${safePart(user.orgId)}/workflows/.../records/...` at `src/app/api/attachments/presign/route.ts:101-112`. There is no lifecycle rule or demo expiry metadata in code. |
| Another browser profile or cleared cookie gets a different install. | Implemented. | Diagram lines 35-36. New install ids are random UUIDs without dashes at `src/lib/auth/middleware.ts:210-212`; org ids derive from the install id at `src/lib/demo/seed-demo-org.ts:8-17`. |
| DynamoDB TTL is `expiresAt` 7 days and matches `ff_demo_install`. | Partially true. | Diagram line 38. Seed expiry is `now + 7 days` at `src/lib/demo/seed-demo-org.ts:309`; install cookie max age is also 7 days at `src/lib/auth/middleware.ts:11` and `src/lib/auth/middleware.ts:269-270`. However `ff_session` defaults to one day at `src/lib/auth/middleware.ts:133-137` and `src/lib/auth/middleware.ts:257-259`, and reopened installs can create mixed TTLs. |
| Automatic cleanup of demo copies. | Not proven by repo; incomplete metadata. | Diagram lines 38-43. `.env.example` only comments that the table uses TTL attribute `expiresAt` at `.env.example:14-19`; no IaC/script in this repo enables DynamoDB TTL or S3 lifecycle. Some demo-created entities do not carry `expiresAt`. |

## Findings

### 1. High - Cookie signing can fall back to a public secret

`SESSION_SECRET` falls back to `COGNITO_CLIENT_ID`, then a hardcoded Cognito client id in the API helper at `src/lib/auth/middleware.ts:8`; the Edge middleware uses the same fallback chain at `middleware.ts:3-6`. Signed session tokens and signed install envelopes both use this secret via `signSessionPayload` / `createSignedEnvelope` at `src/lib/auth/middleware.ts:129-136` and `src/lib/auth/middleware.ts:167-183`.

Impact: if `SESSION_SECRET` is unset in an environment, a public client id becomes the HMAC key. That weakens both `ff_demo_install` and `ff_session`; a forged `ff_session` can carry arbitrary `orgId`, `role`, and `orgs`, and `getAuthUser` trusts a valid signed session at `src/lib/auth/middleware.ts:230-233`. This undercuts the diagram's signed-token isolation claim (`06-demo-isolation-ttl.mmd:5-7`, `06-demo-isolation-ttl.mmd:25`).

Improvement: require `SESSION_SECRET` in production and fail closed when missing. Keep separate secrets for session tokens and demo install envelopes if possible.

### 2. High - Reopened demo installs can develop mixed TTLs

Every login computes a fresh seven-day `expiresAt` at `src/lib/demo/seed-demo-org.ts:309`. The seed flow always rewrites orgs, workflows, users, and devices with that fresh expiry at `src/lib/demo/seed-demo-org.ts:314-331` and `src/lib/demo/seed-demo-org.ts:348-379`, but records and inventory are only written when `existingRecords.length === 0` at `src/lib/demo/seed-demo-org.ts:333-345`.

Impact: if a visitor reopens the same install before the first expiry, the install cookie and some metadata can be extended, while original records and inventory retain the old `expiresAt`. DynamoDB TTL can then delete records/inventory while the refreshed org/workflows/users/devices still exist. That contradicts the diagram's "reuse same demo workspace" plus unified seven-day cleanup model at `06-demo-isolation-ttl.mmd:7`, `06-demo-isolation-ttl.mmd:38-42`.

Improvement: on reuse, either do not extend the sandbox expiry, or update `expiresAt` for every entity in the install, including records, inventory, conflicts, mutations, audit events, and receipts/ledger entries.

### 3. High - Demo-created follow-on data does not consistently carry `expiresAt`

Baseline seed data has `expiresAt` on orgs, workflows, records, inventory, users, devices, login audit, and sandbox metrics (`src/lib/demo/seed-demo-org.ts:325`, `src/lib/demo/seed-demo-org.ts:328-344`, `src/lib/demo/seed-demo-org.ts:362`, `src/lib/demo/seed-demo-org.ts:376`, `src/lib/demo/seed-demo-org.ts:437`, `src/lib/demo/seed-demo-org.ts:448`). However normal demo usage creates additional data without sandbox expiry:

- Sync-created records omit `expiresAt` when building `RecordData` at `src/app/api/sync/batch/route.ts:152-168`.
- Sync mutations have no `expiresAt` field in `MutationEntry` at `src/types/sync.ts:4-12`, and DynamoDB stores only `{ orgId, ...mutation, server_seq }` at `src/lib/api/dynamo-store.ts:535-540`.
- Manual conflict records have no `expiresAt` in `ConflictRecord` at `src/types/sync.ts:85-90`, and sync writes conflicts without expiry at `src/app/api/sync/batch/route.ts:307-320`.
- Conflict audit events written during sync omit expiry at `src/app/api/sync/batch/route.ts:270-282`.
- Device updates preserve `deviceState?.expiresAt` only if a device already exists at `src/app/api/sync/batch/route.ts:356-371`.

Impact: DynamoDB TTL cannot clean all demo copies created during realistic use, especially mutations/conflicts/audit records. This is a direct mismatch with diagram cleanup claims at `06-demo-isolation-ttl.mmd:31-42`.

Improvement: resolve the current org's demo expiry once per request, then stamp it on all demo-scoped writes. Add `expiresAt?: number` to mutation/conflict/audit types or a shared DynamoDB write wrapper that injects expiry for `orgId` values matching `demo-*`.

### 4. High - IndexedDB workflow cache is not org-isolated

The IndexedDB `workflows` object store is keyed only by `id` at `src/lib/db/indexeddb.ts:35-40`. Demo seeding uses the same workflow ids for every org: `wf-1` at `src/lib/demo/seed-demo-org.ts:28`, `wf-community-intake` at `src/lib/demo/seed-demo-org.ts:99`, and `wf-stock-check` at `src/lib/demo/seed-demo-org.ts:154`. Hydration writes all returned demo workspaces into this store at `src/lib/demo/offline-demo-cache.ts:331-344`; `replaceWorkflowsForOrg` deletes by `orgId` but writes by `id`, so later orgs overwrite earlier orgs at `src/lib/db/indexeddb.ts:174-180`.

Impact: the diagram's "IndexedDB: all demo org data" and offline persona/org switching claim (`06-demo-isolation-ttl.mmd:26-29`) is not reliable for workflows. Depending on hydration order, AHK/SRB/LE can lose their local workflow definitions because another org's workflow with the same id overwrote the row.

Improvement: key workflows locally by a composite id such as `${orgId}#${workflow.id}`, or create an IndexedDB index by `orgId` and use a composite primary key. Records are less exposed because seed record ids include the org key, but the same design issue exists anywhere local IDs are not globally unique.

### 5. Medium - Local offline fallback is not DynamoDB-backed and leaves stale IndexedDB data

The demo page falls back to `loadOfflineDemoSandbox() ?? createLocalDemoSandbox()` when `/api/auth/login` fails at `src/app/(public)/demo/page.tsx:85-100`. That local sandbox is generated entirely in the browser at `src/lib/demo/offline-demo-cache.ts:181-223`. `loadOfflineDemoSandbox` refuses expired localStorage metadata at `src/lib/demo/offline-demo-cache.ts:320-329`, but it does not purge IndexedDB records/workflows/conflicts written earlier at `src/lib/demo/offline-demo-cache.ts:295-312`.

Impact: the diagram states demo seeding is in DynamoDB (`06-demo-isolation-ttl.mmd:12`) and offline switching remains valid "while TTL remains valid" (`06-demo-isolation-ttl.mmd:27`). The implementation has a valid local-only fallback for resilience, but it is a false claim to describe every entered demo as DynamoDB-backed. Expired local sandbox metadata also does not clean existing IndexedDB data.

Improvement: make the local-only fallback explicit in docs/diagram, and add a local purge path for expired demo sandbox data.

### 6. Medium - Warmup can create demo installs before an explicit demo login

`OfflineWarmup` runs on online pages and calls `warmDemoSandbox()` through an idle task at `src/components/OfflineWarmup.tsx:242-259`. `warmDemoSandbox` calls `/api/demo/offline` when no fresh local cache exists at `src/components/OfflineWarmup.tsx:211-234`. That endpoint creates or reuses a demo install and seeds the admin AHK persona at `src/app/api/demo/offline/route.ts:18-29`.

Impact: the diagram shows install creation as a result of demo login (`06-demo-isolation-ttl.mmd:3-10`). In practice, normal page warmup can create the `ff_demo_install` cookie, seed all orgs, and write metrics before the visitor presses a demo account. This can inflate sandbox metrics and DynamoDB writes, and it changes the meaning of "selected org/user" for the first metric.

Improvement: either update the diagram/docs to include warmup, or delay server-side seed until explicit demo login and keep prelogin warmup to static route caching.

### 7. Medium - DynamoDB TTL is documented, but table TTL enablement is not represented

The repo contains comments that DynamoDB uses `expiresAt` for TTL at `.env.example:14-19`, and README says TTL metadata is attached so demo workspaces can be cleaned later at `README.md:90-99`. I found no IaC, migration, script, or runtime check that enables DynamoDB Time To Live on the table for the `expiresAt` attribute. DynamoDB reads also do not filter expired records: record/workflow/inventory lists scan by `entityType` and `orgId` only at `src/lib/api/dynamo-store.ts:246-259`, `src/lib/api/dynamo-store.ts:278-283`, and `src/lib/api/dynamo-store.ts:346-351`.

Impact: the diagram's "automatic cleanup" claim (`06-demo-isolation-ttl.mmd:38-42`) depends on external table configuration not visible in the repo. Even when TTL is enabled, DynamoDB TTL deletion is asynchronous, so expired demo data can remain readable until AWS deletes it.

Improvement: add infrastructure or a verification script for TTL enablement, and add application-level expired-demo filtering or rejection for demo orgs where `expiresAt <= now`.

### 8. Medium - S3 evidence isolation is prefix-based only; cleanup is assumed

The presign route scopes upload keys under the authenticated `user.orgId` at `src/app/api/attachments/presign/route.ts:101-112`, so demo uploads would land under a `orgs/demo-...` prefix. The route does not check that `recordId` belongs to the current org before issuing a key, does not attach expiry metadata/tags, and no lifecycle policy is present in the repo. The diagram's wording says S3 evidence "can be lifecycle-managed by prefix" at `06-demo-isolation-ttl.mmd:43`, which is technically possible but not implemented here.

Impact: org-level prefix isolation is present, but cleanup of demo evidence is an operational assumption. A user can also mint object keys for arbitrary workflow/record ids within their org prefix.

Improvement: verify record/workflow ownership before presigning, add demo install tags/metadata to S3 objects, and document or provision a lifecycle policy for `orgs/demo-*`.

### 9. Medium - "Per-user isolation" is actually install-level sharing inside one browser

The server creates install/org-scoped user profiles for each membership at `src/lib/demo/seed-demo-org.ts:348-379`, and selected sessions include only the persona's allowed orgs at `src/lib/demo/seed-demo-org.ts:381-391`. That is good for server-side org switching: `/api/auth/org` rejects orgs outside the session's `orgs` list at `src/app/api/auth/org/route.ts:16-18`.

However, the browser stores all demo accounts for the install at `src/app/api/auth/login/route.ts:75-76` and persists them to localStorage at `src/app/(public)/demo/page.tsx:74-80`. On network failure, the demo page can select any cached account and set it as the current auth user at `src/app/(public)/demo/page.tsx:85-100`.

Impact: this is probably intended for a public persona-switching demo, but it is not per-user isolation within a browser profile. The isolation boundary is the install/browser profile plus org-scoped server authorization, not a private dataset per persona.

Improvement: describe this as install-scoped persona sharing, or split local cached accounts if the product claim needs true per-user isolation.

### 10. Low - Session lifetime does not match the install TTL

The diagram says the seven-day `expiresAt` matches the `ff_demo_install` cookie at `06-demo-isolation-ttl.mmd:38`. That is approximately true for the install cookie: `DEMO_INSTALL_MAX_AGE` is seven days at `src/lib/auth/middleware.ts:11`, and seed expiry is seven days at `src/lib/demo/seed-demo-org.ts:309`. But `ff_session` defaults to one day when created without an explicit max age at `src/lib/auth/middleware.ts:133-137` and `src/lib/auth/middleware.ts:257-259`; demo login uses that default at `src/app/api/auth/login/route.ts:48-80`.

Impact: after one day, the install can still be valid while the server session is expired. The persisted Zustand auth store has no expiry and persists `user`, `org`, and `orgs` at `src/stores/authStore.ts:17-39`, so the UI can retain a user locally even when APIs reject the session.

Improvement: either set demo `ff_session` to the install TTL or document that the install TTL and active session TTL are separate. Add expiry-aware client auth hydration.

## Confirmed Strengths

- Demo org ids are deterministic per install and org key (`src/lib/demo/seed-demo-org.ts:8-17`), so a browser profile reuses the same DynamoDB keyspace while another profile gets different keys.
- Server-side selected org membership is validated on login (`src/app/api/auth/login/route.ts:42-45`) and org switch (`src/app/api/auth/org/route.ts:16-18`).
- DynamoDB primary keys are consistently org-prefixed for records, workflows, devices, conflicts, inventory, inventory receipts, inventory ledger, mutations, audit, and metrics (`src/lib/api/dynamo-store.ts:185-223`).
- Seeded inventory receipts and ledger entries inherit the inventory item's expiry during DynamoDB reservation flows (`src/lib/api/dynamo-store.ts:380-407`, `src/lib/api/dynamo-store.ts:441-466`).
- Browser localStorage rejects expired demo sandbox metadata before reuse (`src/lib/demo/offline-demo-cache.ts:320-329`).

## Recommended Fix Order

1. Make `SESSION_SECRET` mandatory outside local development; remove public fallback signing.
2. Fix local IndexedDB workflow keys to include `orgId`.
3. Define a single demo expiry source per install and stamp every demo-scoped write with it.
4. Decide whether reopening an install extends TTL; if yes, refresh all entity TTLs atomically or with a targeted bulk update.
5. Add TTL enablement/verification to infrastructure or deployment checks.
6. Add expired-demo filtering/rejection in API reads because DynamoDB TTL deletion is asynchronous.
7. Add S3 lifecycle provisioning and object ownership checks for presigned uploads.
8. Update the diagram to show warmup-created sandboxes and the local-only fallback path.
