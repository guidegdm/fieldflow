# Ranked Remediation Plan

Date: 2026-07-01
Branch: `audit`

## Fix Order

### P0: Stop black/raw offline screens

Status: implemented on `audit`.

Why first:
This affects trust immediately. A PWA must never display raw React Flight payloads or plain backend responses as a screen.

Changes:
- HTML-only page cache.
- RSC request exclusion.
- Bad page-cache purge on service-worker activation.
- Offline-safe logout.

### P0: OAuth state validation

Status: implemented on `audit`.

Why second:
This closes the highest-risk auth bug.

### P1: Org-scoped offline conflicts

Status: implemented on `audit`.

Why third:
Tenant/workspace isolation must be correct before deeper offline behavior is trusted.

### P1: S3 presign ownership checks

Status: implemented on `audit`.

Why fourth:
Attachment upload is a write path and must be bound to the authenticated org/workflow/record.

### P2: Auth and data-path latency

Status: partially implemented on `audit`.

Done:
- Cognito imported key cache.

Next:
- Reduce duplicate session verification.
- Add membership-version checks for sensitive routes.
- Add workflow summary rows and projection reads.

### P2: Route warmup consolidation

Status: not yet implemented.

Next:
- Create a single warmup coordinator.
- Add route/data manifest versioning.
- Avoid repeated full demo payload downloads when local IndexedDB is already current.
