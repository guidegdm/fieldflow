# Latency / Optimization Audit

Date: 2026-07-01
Branch: `audit`

## Findings

### High: auth verification repeated expensive key imports

File:
- `src/lib/auth/middleware.ts`

Risk:
JWT verification imported the Cognito RSA key for each verification.

Fix applied:
- Imported `CryptoKey`s are now cached by JWK modulus/exponent.

### High: demo and offline warmup duplicate route-cache work

Files:
- `src/components/OfflineWarmup.tsx`
- `src/lib/demo/offline-demo-cache.ts`
- `worker/index.js`

Risk:
The app warms routes from multiple places. That helps offline reliability but can produce duplicate work and extra network traffic.

Partial fix applied:
- Warmup now avoids caching invalid page responses.

Remaining:
- Consolidate route warmup into one owner.
- Add a versioned route manifest so warmup can skip already-current routes.

### Medium: workflows endpoint loads more than the UI needs

Files:
- `src/app/api/workflows/route.ts`
- `src/lib/api/dynamo-store.ts`

Risk:
The endpoint attaches record counts by loading broad record sets.

Recommendation:
- Store/update workflow record counts as summary rows.
- Use projection reads for workflow lists.

### Medium: app boot has a heavy global client layer

Files:
- `src/app/layout.tsx`
- `src/components/layout/ClientLayout.tsx`

Risk:
Service worker registration, warmup, install prompt, update prompt, passkey prompt, and sync manager all run from the root client shell.

Recommendation:
- Lazy-load noncritical managers after first paint.
- Keep auth/i18n shell minimal on public pages.

## Remaining Recommendations

1. Add in-flight dedupe to workflow list loading.
2. Batch demo seeding writes.
3. Remove scan fallback outside migration mode.
4. Reduce app-version polling and rely more on service-worker update events.
