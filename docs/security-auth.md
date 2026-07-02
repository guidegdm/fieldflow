# Security And Auth

FieldFlow has two auth tracks:

- Real users authenticate through Amazon Cognito and receive HttpOnly app cookies.
- Demo users receive signed demo/session cookies and isolated seeded workspaces.

The central verifier is `verifyCognitoJWT()`, which validates Cognito RS256 JWT signatures against JWKS and checks expiry, issuer, token use, and client identifiers in [src/lib/auth/middleware.ts](../src/lib/auth/middleware.ts:27).

## Cookies And Sessions

Auth route handlers set these cookies:

| Cookie | Purpose | Notes |
| --- | --- | --- |
| `ff_access` | Cognito access token | HttpOnly, Secure, SameSite=Lax, about 1 hour. |
| `ff_refresh` | Cognito refresh token | HttpOnly, Secure, SameSite=Lax, about 30 days. |
| `ff_session` | Signed FieldFlow app context | Carries resolved user/org/role context for app routing. |
| `ff_oauth_state` | OAuth CSRF/state token | Scoped to callback route and short lived. |
| `ff_demo_install` | Demo install identity | Per-browser demo identity with TTL. |

Cookie helpers are implemented in [src/lib/auth/middleware.ts](../src/lib/auth/middleware.ts:327). Refresh is handled by [src/app/api/auth/refresh/route.ts](../src/app/api/auth/refresh/route.ts:12), which uses Cognito `REFRESH_TOKEN_AUTH` and rewrites `ff_access`.

Logout clears `ff_session`, `ff_access`, and `ff_refresh` in [src/app/api/auth/logout/route.ts](../src/app/api/auth/logout/route.ts:1). If the browser logs out while offline, [src/lib/auth/client-logout.ts](../src/lib/auth/client-logout.ts:17) stores a pending logout and [src/components/ServiceWorkerRegister.tsx](../src/components/ServiceWorkerRegister.tsx:28) flushes it when online.

## Signup And Email Verification

Signup uses Cognito `SignUpCommand` in [src/app/api/auth/signup/route.ts](../src/app/api/auth/signup/route.ts:37). The route validates email, password, user name, workspace name, and sector before asking Cognito to create the account.

Confirmation is handled by [src/app/api/auth/confirm-signup/route.ts](../src/app/api/auth/confirm-signup/route.ts:40). After Cognito confirmation, the app creates the workspace/org profile, writes the org-admin membership to the store, signs the user in, and sets the cookies.

If a user tries to sign in before confirming email, [src/app/api/auth/login/route.ts](../src/app/api/auth/login/route.ts:89) catches `UserNotConfirmedException`, resends a confirmation code, and returns an `email_unconfirmed` flow for the UI.

Password reset uses [src/app/api/auth/forgot-password/route.ts](../src/app/api/auth/forgot-password/route.ts:32) and [src/app/api/auth/reset-password/route.ts](../src/app/api/auth/reset-password/route.ts:28). Local password validation is aligned with Cognito's configured policy before submitting reset confirmation.

## OAuth And Passkeys

Google OAuth redirects through Cognito Hosted UI from [src/app/api/auth/oauth/google/route.ts](../src/app/api/auth/oauth/google/route.ts:17). The callback route validates OAuth state, exchanges the code, verifies the id token, resolves workspace membership, and redirects to the appropriate dashboard or setup flow in [src/app/api/auth/callback/route.ts](../src/app/api/auth/callback/route.ts:25).

Passkey support has two pieces:

- The sign-in page includes a passkey sign-in button that redirects to Cognito Hosted UI through [src/app/api/auth/oauth/passkey/route.ts](../src/app/api/auth/oauth/passkey/route.ts:17).
- Logged-in users can register a passkey through Cognito WebAuthn commands in [src/app/api/auth/passkey/route.ts](../src/app/api/auth/passkey/route.ts:33) and browser WebAuthn in [src/lib/auth/webauthn-client.ts](../src/lib/auth/webauthn-client.ts:31).

The local code implements WebAuthn registration. Actual passkey sign-in UI is delegated to Cognito Hosted UI; there is no custom local `navigator.credentials.get()` assertion flow in the repository.

The passkey registration prompt is rendered globally by the client layout and only appears for non-demo authenticated users when online, the browser supports WebAuthn, and the prompt has not been recently dismissed. The component lives in [src/components/PasskeyPrompt.tsx](../src/components/PasskeyPrompt.tsx:33).

## Workspaces, Invites, And RBAC

Roles are defined as `field_worker`, `supervisor`, and `org_admin` in [src/types/auth.ts](../src/types/auth.ts:1). Role ranking is implemented in [src/lib/auth/roles.ts](../src/lib/auth/roles.ts:1), where admins inherit supervisor and worker access, and supervisors inherit worker access.

Workspace membership is profile-backed. `resolveWorkspaceMembership()` reads user profiles by email, accepts valid pending invites, resolves the active org, and returns an org list in [src/lib/auth/workspace-membership.ts](../src/lib/auth/workspace-membership.ts:30).

Admins invite users through [src/app/api/admin/users/route.ts](../src/app/api/admin/users/route.ts:49). The route creates or updates a user profile in the current org, optionally calls Cognito `AdminCreateUserCommand`, and stores invite metadata such as `inviteStatus`, `inviteExpiresAt`, and `invitedBy`.

Workspace switching is handled by [src/app/api/auth/org/route.ts](../src/app/api/auth/org/route.ts:9), which verifies the user belongs to the requested org and rewrites `ff_session`.

## Offline Auth Behavior

The client stores user/org/orgs metadata in the persisted Zustand auth store [src/stores/authStore.ts](../src/stores/authStore.ts:23). It does not store Cognito access or refresh tokens in JavaScript-readable storage.

`useRequireSession()` revalidates through `/api/auth/session` when online, but allows route access from the hydrated local auth store while offline if the cached role is compatible with the route. See [src/hooks/useRequireSession.ts](../src/hooks/useRequireSession.ts:13).

This is a deliberate offline-first tradeoff: protected UI can continue to function offline from previously validated local metadata, but server-side revocation is not observable until reconnect.

## Security Controls

- Cognito JWTs are signature verified, not base64-decoded only: [src/lib/auth/middleware.ts](../src/lib/auth/middleware.ts:86).
- App cookies are HttpOnly/Secure/SameSite=Lax: [src/lib/auth/middleware.ts](../src/lib/auth/middleware.ts:327).
- Auth routes use request validation and rate limiting: [src/lib/auth/rate-limit.ts](../src/lib/auth/rate-limit.ts:1).
- Sensitive routes require auth and role checks, including workflow publish, users, inventory reservation, attachment presign, sync, and engineering snapshot.
- Workflow definitions are validated before publish in [src/lib/workflows/validate-definition.ts](../src/lib/workflows/validate-definition.ts:23).

## Known Limitations

- There is no durable server-side session revocation list. Issued Cognito tokens remain valid until Cognito expiry.
- Offline auth is cached metadata, not cryptographic offline revalidation.
- Invite acceptance happens automatically on matching email login; there is no separate accept-invite endpoint.
- Passkey sign-in depends on Cognito Hosted UI configuration.

