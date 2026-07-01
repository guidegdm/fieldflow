# Security / Auth Audit

Date: 2026-07-01
Branch: `audit`

## Findings

### Critical: OAuth callback did not validate state

Files:
- `src/app/api/auth/oauth/google/route.ts`
- `src/app/api/auth/oauth/passkey/route.ts`
- `src/app/api/auth/callback/route.ts`
- `src/lib/auth/middleware.ts`

Risk:
A valid authorization code could be replayed into another browser session because the callback did not verify the OAuth `state`.

Fix applied:
- OAuth start routes now create a signed, expiring state token.
- The token is also stored in an HttpOnly `ff_oauth_state` cookie scoped to `/api/auth/callback`.
- The callback rejects missing, mismatched, expired, or invalid state and clears the cookie after use.

### High: offline conflicts were not org-scoped

Files:
- `src/types/sync.ts`
- `src/lib/db/indexeddb.ts`
- `src/lib/sync/sync-client.ts`
- `src/lib/sync/run-background-sync.ts`
- `src/lib/sync/offline-conflict-resolution.ts`
- `src/lib/demo/offline-demo-cache.ts`
- `src/app/(routes)/field-worker/conflicts/page.tsx`
- `src/app/(routes)/supervisor/conflicts/page.tsx`
- `src/app/(routes)/field-worker/home/page.tsx`
- `src/app/(routes)/admin/dashboard/page.tsx`

Risk:
One browser profile with multiple workspaces could show or resolve conflicts from the wrong workspace.

Fix applied:
- `ConflictRecord` now carries `orgId`.
- IndexedDB conflict keys are scoped by org.
- Conflict reads/writes/resolution paths now pass the active org.

### Medium: S3 attachment presign trusted client workflow/record IDs

File:
- `src/app/api/attachments/presign/route.ts`

Risk:
An authenticated user could request an upload URL for arbitrary workflow/record IDs inside the current org, creating orphaned uploads or evidence attached to the wrong item.

Fix applied:
- Presign now verifies the workflow exists in the authenticated org.
- Presign now verifies the record exists in the authenticated org and belongs to that workflow.
- Presign now verifies the field exists and is a `photo` field.

## Remaining Recommendations

- Add revocation or membership-version checks for sensitive auth decisions.
- Add server-side audit rows for rejected OAuth state and rejected presign attempts.
- Add API tests for OAuth callback state mismatch and cross-org presign attempts.
