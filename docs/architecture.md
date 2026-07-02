# Architecture

FieldFlow is an offline-first Next.js application for field operations. The browser owns the resilient work surface: the PWA shell, IndexedDB, local mutation queue, local attachment queue, language preference, and install/update prompts. The server side is a set of Next.js route handlers that enforce auth, workspace boundaries, workflow publication, sync, conflict persistence, inventory reservations, S3 presigning, and AI requests.

## Runtime View

```text
Browser / PWA
  React UI
  Zustand stores
  IndexedDB local data
  Service worker page cache
  Background sync coordinator
        |
        | HTTPS, HttpOnly cookies
        v
Next.js API routes on Vercel
  Auth/session validation
  Workspace membership
  Workflow and record APIs
  Sync batch and conflict APIs
  Inventory reservation API
  S3 presign API
  AI agent API
        |
        +-- Amazon Cognito
        +-- Amazon DynamoDB
        +-- Amazon S3
        +-- DeepSeek-compatible API
```

The app shell is mounted through [src/components/layout/ClientLayout.tsx](../src/components/layout/ClientLayout.tsx:65), which loads the global runtime helpers: service worker registration, offline warmup, install prompt, update manager, workspace sync manager, passkey prompt, and i18n preload.

## Main Source Areas

| Area | Files |
| --- | --- |
| Pages and route handlers | [src/app](../src/app) |
| Auth/session helpers | [src/lib/auth](../src/lib/auth) |
| DynamoDB/in-memory store adapters | [src/lib/api](../src/lib/api) |
| IndexedDB adapter | [src/lib/db/indexeddb.ts](../src/lib/db/indexeddb.ts:116) |
| Sync pipeline | [src/lib/sync](../src/lib/sync) |
| Demo sandbox and offline hydration | [src/lib/demo](../src/lib/demo) |
| Workflow validation/runtime | [src/lib/workflows](../src/lib/workflows) |
| AI assistant | [src/lib/ai](../src/lib/ai), [src/stores/agentStore.ts](../src/stores/agentStore.ts) |
| PWA worker | [worker/index.js](../worker/index.js) |
| i18n bundle | [src/lib/i18n](../src/lib/i18n) |

## Service Boundaries

The browser does not read Cognito access or refresh tokens. Route handlers set HttpOnly cookies, and protected API routes call `getAuthUser()` before touching org-scoped data. See [security-auth.md](./security-auth.md).

DynamoDB is the primary persistence layer. The in-memory store exists as a local fallback/development path, but it is not durable across process restarts. See [data-model.md](./data-model.md).

The service worker caches navigable HTML pages and forwards sync/update events to live clients. The page runtime performs the actual sync logic through the pipeline coordinator. See [offline-sync.md](./offline-sync.md).

## Current Limitations

- There is no separate AWS Lambda or API Gateway layer in this repository. The backend is Next.js route handlers deployed with the app.
- There is no Aurora DSQL implementation in the current code. Inventory correctness is implemented through DynamoDB transactions.
- Background sync is browser-dependent and currently relays to open window clients; it is not a standalone worker-side sync engine.
- Workflow role `permissions` arrays are descriptive metadata in most places. Runtime review/state access is mainly controlled by role ranking and transition `requiredRoles`.

