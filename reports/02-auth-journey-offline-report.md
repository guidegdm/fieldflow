# FieldFlow Authentication Journey and Offline Auth Audit

Scope: actual code only. I traced signup, email/OTP verification, password reset, Google OAuth callback, Cognito token/cookie/session refresh, frontend role gating, and offline behavior across the route handlers, shared auth helpers, layouts, and service worker.

## Executive Summary

The happy path exists, but the trust boundaries are too loose. The biggest risks are in token verification and token signing, where the code can accept or mint auth artifacts without a strong fail-closed path. The frontend also has one unguarded protected surface (`/engineering`) and the offline layer keeps cached authenticated pages and IndexedDB data around after logout.

## Findings

### 1. Critical: Cognito JWT verification is not fail-closed

`verifyCognitoJWT()` only verifies the RSA signature when the header says `RS256` and a `kid` exists, and even then it only rejects on invalid signature if a key was found. If the header uses another `alg`, if the `kid` is missing, or if the JWKS fetch returns no keys, the function still falls through and returns a user object. See `src/lib/auth/middleware.ts:71-112`, especially `:87-95`.

Impact: a forged or tampered JWT can be accepted as authenticated in the login, OTP, refresh, callback, and request-auth paths that call this helper.

Suggestion: reject anything that is not explicitly validated. If the header is not `RS256`, or if there is no matching JWKS key, return `null` immediately. Treat JWKS fetch failure as auth failure, not success.

### 2. Critical: Session and pending-setup tokens fall back to a public client ID as their secret

`SESSION_SECRET` falls back to `COGNITO_CLIENT_ID` / `NEXT_PUBLIC_COGNITO_CLIENT_ID` in `src/lib/auth/middleware.ts:3-8`, and the same helper signs `ff_session`, `ff_pending_setup`, and `ff_demo_install` envelopes in `:129-198` and `:201-274`. The sample env leaves `SESSION_SECRET` blank in `.env.example:35-36`, so the insecure fallback is the documented default setup.

Impact: anyone who knows the Cognito client ID can forge signed session or pending-setup cookies if the deployment does not override `SESSION_SECRET`.

Suggestion: require `SESSION_SECRET` and fail startup if it is missing. Do not reuse a public OAuth client ID as an HMAC secret.

### 3. High: Google OAuth state is generated but never validated

The OAuth entrypoint encodes `mode` and `next` into `state` in `src/app/api/auth/oauth/google/route.ts:16-31`, but the callback never reads or verifies it. `src/app/api/auth/callback/route.ts:35-125` exchanges the code and proceeds without any state correlation.

Impact: this removes the normal CSRF/request-binding protection on the OAuth callback, and the `next` value is dead code. The callback also uses the decoded JWT payload in the setup branch even when `verifyCognitoJWT()` returned `null` (`:74-105`), so that branch is especially trust-heavy.

Suggestion: persist a nonce-bound state cookie, verify it on callback, and reject mismatches before touching cookies or the local store. Do not rely on the decoded payload unless the token has already been verified.

### 4. High: The engineering route has no frontend auth gate

`src/app/(routes)/engineering/layout.tsx:3-6` renders `AppShell` directly and never calls `useRequireSession()`. The page then loads local IndexedDB state on mount in `src/app/(routes)/engineering/page.tsx:42-79`, while the backing API is server-gated in `src/app/api/engineering/snapshot/route.ts:5-15`.

Impact: the API is protected, but the frontend surface is not. If the browser already has cached local data from a prior authenticated session, the engineering page can still render that local state without a fresh auth check.

Suggestion: guard the route the same way the admin and supervisor layouts do. If this view is meant to be internal-only, make the frontend fail closed before reading local data.

### 5. High: Signup confirmation and Google setup write local state before all side effects finish

`confirm-signup` confirms Cognito, writes the org row and profile row, updates Cognito attributes, and only then tries to sign the user in. The local writes happen before the post-write auth step in `src/app/api/auth/confirm-signup/route.ts:52-63`, `:68-93`, and `:95-119`. If `InitiateAuthCommand` fails after the store write, the request errors out but the org/profile remain created.

`setup` does the same pattern: it writes the org/profile first in `src/app/api/auth/setup/route.ts:57-80`, then treats Cognito attribute update failure as non-fatal in `:83-94`, and still returns success with a session in `:96-122`.

Impact: partial org creation is possible, retries can create duplicate orgs because `generateId()` is called each time, and Cognito metadata can drift from the local profile store.

Suggestion: make org/profile creation transactional or add compensating cleanup on failure. At minimum, handle the auth step inside the same failure path and do not return success after a partial write.

### 6. Medium: The password-reset and OAuth failure journeys do not round-trip into the signin UI

The reset flow redirects to `/auth/signin?email=...` in `src/app/(public)/auth/reset-password/page.tsx:43-57`, and the OAuth callback redirects to `/auth/signin?error=...` on several failure paths in `src/app/api/auth/callback/route.ts:40-43`, `:59-71`, and `:115-118`. The signin page does not read either query param; it only manages local form and challenge state in `src/app/(public)/auth/signin/page.tsx:32-45`, `:136-139`, and `:216-228`.

Impact: users land back on a generic signin form with no prefilled email and no visible OAuth error message.

Suggestion: read `useSearchParams()` on the signin page, prefill the email field from `email`, and render callback errors from `error`.

### 7. Medium: Auth state persists bearer/session tokens in client storage

`DemoUser` includes an optional `token` field in `src/types/auth.ts:4-6`, and the Zustand auth store persists the entire `user` object to `localStorage` in `src/stores/authStore.ts:17-39`. The login, OTP, and confirm-signup routes all include a token in the JSON user payload (`src/app/api/auth/login/route.ts:117-124`, `src/app/api/auth/otp/route.ts:65-72`, `src/app/api/auth/confirm-signup/route.ts:107-118`), so that token is written into persistent client state.

Impact: the app already uses HttpOnly cookies, so storing the token in JS-readable persistent state increases the blast radius of XSS or extension compromise without adding much value.

Suggestion: strip `token` before persisting auth state, or stop sending it in the JSON response if the cookie is the real session mechanism.

### 8. Medium: Offline auth is durable, but logout does not purge offline artifacts

Offline access depends on persisted `user/orgs` plus local caches. `useRequireSession()` trusts the hydrated store when offline in `src/hooks/useRequireSession.ts:26-29` and `:51-56`. The store persists `user`, `org`, and `orgs` in `src/stores/authStore.ts:33-39`. The offline warmup code caches authenticated routes and workspace data in IndexedDB and the Cache API in `src/components/OfflineWarmup.tsx:66-109`, `:173-180`, `:236-275`, and the service worker serves cached HTML when network fetches fail in `public/sw.js:1`.

The logout route only clears cookies in `src/app/api/auth/logout/route.ts:4-9`; it does not clear IndexedDB or the page cache.

Impact: a browser that once had a valid session can keep showing offline-authenticated pages and local workspace data after logout or session expiry, especially if the service worker already cached those pages.

Suggestion: make logout purge the auth store, offline demo sandbox, IndexedDB workspace data, and the `fieldflow-pages` cache. If offline replay is intended, namespace caches per install/user and make the UI label that state explicitly.

### 9. Medium: Offline org switching is online-only

`OrgSwitcher` optimistically updates local state, then always POSTs to `/api/auth/org` and reverts if the request fails in `src/components/layout/OrgSwitcher.tsx:14-36`.

Impact: an offline user can continue in the currently loaded org, but cannot switch to another cached org even if the org list is already present in local state.

Suggestion: either disable the control offline or add an offline fallback that switches only the local store and clearly marks the session as unsynced.

### 10. Medium: Email normalization is inconsistent across the auth journey

Signup, login, and confirm-signup all pass the raw email string through to Cognito and the profile store (`src/app/api/auth/signup/route.ts:40-55`, `src/app/api/auth/login/route.ts:29-47`, `src/app/api/auth/confirm-signup/route.ts:49-80`). Forgot-password and reset-password lower-case the email before sending it to Cognito (`src/app/api/auth/forgot-password/route.ts:35-48`, `src/app/api/auth/reset-password/route.ts:37-49`).

Impact: case variants can behave differently across signup, login, reset, and membership lookup. Depending on Cognito configuration, this can produce duplicate or unresolvable accounts.

Suggestion: canonicalize email at the boundary once, then use the same normalized value everywhere in the auth flow.

### 11. Additional security concern: rate limiting is only in-memory and IP-header based

`checkRateLimit()` stores buckets in a process-local `Map` and keys them off `x-forwarded-for` / `x-real-ip` in `src/lib/auth/rate-limit.ts:6-29`. Every auth route uses it.

Impact: the limits reset on process restart, are not shared across instances, and can be weak if upstream proxy headers are not sanitized.

Suggestion: move auth throttling to a shared store or edge-native limiter, and only trust forwarded IPs when the deployment guarantees they were set by a trusted proxy.

## Priority Fix Order

1. Make JWT verification fail closed and require a real `SESSION_SECRET`.
2. Add OAuth state validation and stop trusting unverified callback payloads.
3. Gate `/engineering` in the frontend and purge offline artifacts on logout.
4. Make confirm-signup/setup transactional or compensating.
5. Normalize email handling and wire the signin page to the reset/OAuth query params.

