# FieldFlow Documentation

This folder is the current codebase documentation for FieldFlow. It intentionally replaces the older speculative planning docs. Each page below describes what is implemented in the repository now and cites source files so the documentation can be audited against code.

## Contents

| Document | Purpose |
| --- | --- |
| [architecture.md](./architecture.md) | Runtime architecture, repository map, service boundaries, and current limitations. |
| [security-auth.md](./security-auth.md) | Cognito auth, signed app sessions, OAuth, passkeys, invites, RBAC, and offline auth behavior. |
| [offline-sync.md](./offline-sync.md) | PWA caching, IndexedDB, route warmup, sync pipeline, conflict handling, and app update behavior. |
| [data-model.md](./data-model.md) | DynamoDB single-table model, entity keys, GSIs, TTL, demo metrics, inventory transactions, and S3 attachments. |
| [workflow-engine.md](./workflow-engine.md) | Workflow definitions, builder behavior, record lifecycle, supervisor review, conflict integration, and role capabilities. |
| [ai-assistant.md](./ai-assistant.md) | AI workflow assistant loop, tools, validation, DeepSeek call path, and safety limits. |
| [ui-philosophy.md](./ui-philosophy.md) | Visual language, typography, colors, page structure, controls, loaders, motion, and responsive rules. |
| [operations-deployment.md](./operations-deployment.md) | Environment variables, local commands, production build behavior, AWS resources, and verification notes. |

## Current Stack

- Next.js App Router, React, TypeScript, Tailwind CSS.
- Amazon Cognito for real users, Google OAuth through Cognito Hosted UI, and Cognito WebAuthn registration for passkeys.
- Amazon DynamoDB `FieldFlowRecordsV2` as the primary backend.
- Amazon S3 private bucket for compressed photo evidence uploaded through presigned URLs.
- IndexedDB for local records, workflows, mutations, attachments, conflicts, projections, and device checkpoints.
- `next-pwa` plus a custom worker in [worker/index.js](../worker/index.js) for page caching and sync/update messaging.
- DeepSeek-compatible chat completions endpoint for AI-assisted workflow drafting.

## Documentation Rules

- Do not describe planned architecture as implemented architecture.
- Prefer links to concrete files and line numbers over broad claims.
- If behavior is best-effort, local-only, or browser-dependent, say so directly.
- Keep the old hackathon/story material out of this folder unless it reflects the current code.
