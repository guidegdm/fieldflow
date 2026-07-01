# Native Offline / PWA Audit

Date: 2026-07-01
Branch: `audit`

## Scope

This audit checks offline navigation, service-worker caching, route warmup, logout while offline, update behavior, and black/raw payload screens.

## Findings

### High: navigation cache can replay non-page payloads

Files:
- `next.config.ts`
- `worker/index.js`
- `src/components/OfflineWarmup.tsx`
- `src/lib/demo/offline-demo-cache.ts`

Risk:
Next App Router can request React Server Component payloads using `_rsc`, `RSC: 1`, or `Accept: text/x-component`. If one of those responses reaches the document cache, the browser can display raw React Flight payload text instead of the app shell.

Fix applied:
- Workbox navigation caching now rejects `_rsc`, `RSC: 1`, and `text/x-component`.
- The custom worker now refuses RSC requests, only stores `text/html`, and purges existing bad page-cache entries on activation.
- Client warmup code now only writes real HTML responses to `fieldflow-pages`.

### High: logout while offline could delete the app shell

Files:
- `src/lib/auth/client-session-cleanup.ts`
- `src/lib/auth/client-logout.ts`
- `src/components/layout/Drawer.tsx`
- `src/components/layout/MobileAccountMenu.tsx`
- `src/components/public/PublicAccountMenu.tsx`
- `src/components/layout/Sidebar.tsx`

Risk:
Logout previously deleted the page caches and then navigated to `/`. Offline, that can leave no app shell to render and produce a black/plain failure screen.

Fix applied:
- Logout is now local-first.
- It clears auth/session state, preserves durable app shell caches, purges poisoned page responses, and queues server cookie cleanup for the next online event.

### Medium: forced session eviction did not purge local state

File:
- `src/hooks/useRequireSession.ts`

Risk:
If `/api/auth/session` returned 401, the app only cleared Zustand state and redirected. IndexedDB/cache state could remain.

Fix applied:
- Forced logout now uses the same local-first cleanup helper as explicit logout.

## Remaining Recommendations

- Add a versioned offline route manifest per workspace.
- Add automated Playwright offline tests for route reload, dynamic record pages, and logout.
- Consider namespacing the page cache by app version if update churn remains visible.
