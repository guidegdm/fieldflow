<picture>
  <source media="(prefers-color-scheme: dark)" srcset="">
  <img alt="FieldFlow" src="">
</picture>

# FieldFlow

**Offline-first humanitarian workflow platform for eastern DRC.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://fieldflow-tau.vercel.app)
[![Stack: Next.js](https://img.shields.io/badge/Stack-Next.js%2016%20%7C%20React%2019%20%7C%20AWS-000?logo=next.js)](https://nextjs.org)

[🌐 Live Demo](https://fieldflow-tau.vercel.app) · [📖 Full Documentation](./docs) · [🎥 Demo Video](https://youtu.be)

---

## Problem

The eastern Democratic Republic of Congo is home to **7.3 million internally displaced persons (IDPs)**. Humanitarian organisations operating there face extreme operational challenges:

- **17–25% internet penetration** — cloud-dependent field tools are unusable
- **Shared 5" phones** on solar/diesel charging — devices are low-resource, not smartphones
- **65% adult literacy** — interfaces must be icon-driven and Swahili-friendly
- **Multiple disconnected systems** — paper forms, Excel sheets, siloed NGO databases

Field workers register families, distribute aid, and manage inventory in areas where connectivity is measured in hours per day, not always-on. Existing tools (ODK, KoBoToolbox, CommCare) are either cloud-only, lack conflict-aware merge, or cannot operate on shared budget devices.

## Solution

FieldFlow is a **hybrid offline-first PWA** architected for the connectivity and device constraints of eastern DRC.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                     PWA (Vercel)                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Next.js  │  │  Zustand │  │   IndexedDB       │  │
│  │ App      │  │  Stores  │  │   (Offline Queue) │  │
│  │ Router   │  │          │  │                   │  │
│  └────┬─────┘  └──────────┘  └────────┬──────────┘  │
│       │                                │             │
│  ┌────▼────────────────────────────────▼──────────┐  │
│  │            Sync Protocol (idempotent)          │  │
│  │  ┌──────────┐   conflict-aware   ┌──────────┐  │  │
│  │  │  Push    │ ◄─────────────────► │  Pull    │  │  │
│  │  └──────────┘                     └──────────┘  │  │
│  └───────────────────────┬─────────────────────────┘  │
└──────────────────────────┼───────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────┐
│              AWS Backend                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │   DynamoDB   │  │    Cognito   │  │  Aurora    │  │
│  │  (Operational)│  │   (Auth)    │  │ DSQL (Crit)│  │
│  └──────────────┘  └──────────────┘  └────────────┘  │
│  ┌────────────────────────────────────────────────┐   │
│  │  Workflow Compiler  │  Conflict Resolution     │   │
│  └────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

**Key design decisions:**
- **Offline-first:** IndexedDB local store with operation-based sync queue
- **Conflict-aware merge:** Per-field resolution strategies with human escalation
- **Hybrid consistency:** DynamoDB for operational data, Aurora DSQL for critical inventory operations
- **Workflow compiler:** Multi-step state machine with role-based transitions, not just forms
- **RBAC:** Three tiers — `field_worker`, `supervisor`, `org_admin`

### Screenshots

<!-- TODO: Replace with actual screenshots -->

| Field Worker Registration | Workflow Builder | Conflict Resolution |
|--------------------------|------------------|-------------------|
| ![Screenshot 1]()        | ![Screenshot 2]() | ![Screenshot 3]() |

| Admin Dashboard | Inventory Management | Sync Status |
|-----------------|---------------------|-------------|
| ![Screenshot 4]() | ![Screenshot 5]()   | ![Screenshot 6]() |

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16 |
| UI | React | 19 |
| Styling | Tailwind CSS | 4 |
| State | Zustand | 5 |
| i18n | react-i18next | — |
| Database (local) | IndexedDB (idb) | — |
| Database (cloud) | AWS DynamoDB | — |
| Auth | AWS Cognito | — |
| Critical Ops | Aurora DSQL | — |
| Deployment | Vercel | — |

## Setup

```bash
git clone https://github.com/your-org/fieldflow.git
cd fieldflow
npm install
cp .env.example .env.local  # fill in your credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo login credentials:

| Email | Password | Role |
|-------|----------|------|
| jean-pierre@demo.org | — | field_worker |
| fatima@demo.org | — | field_worker |
| amara@demo.org | — | supervisor |
| celine@demo.org | — | org_admin |

## Project Structure

```
src/
├── app/              # Next.js App Router (public + routes + API)
├── components/       # React components (builder, conflicts, layout, ui)
├── hooks/            # Custom hooks (useSync, useNetwork, etc.)
├── lib/              # Core logic (api, auth, db, i18n, sync)
├── stores/           # Zustand stores (auth, sync, workflow)
├── styles/           # Tailwind globals
└── types/            # TypeScript interfaces
```

## Team

| Name | Role |
|------|------|
| **Céline M.** | Product & Design |
| **Dr. Amara** | Domain Expert — Humanitarian Operations |
| _Your name here_ | Engineering |

## License

[MIT](LICENSE)
