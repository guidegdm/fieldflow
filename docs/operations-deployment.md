# Operations And Deployment

FieldFlow is a Next.js application intended for Vercel deployment with AWS-backed services.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm run start
```

The scripts are defined in [package.json](../package.json:6). Development and production builds use webpack through `next dev --webpack` and `next build --webpack`.

## Required Environment

Important production variables include:

```bash
NEXT_PUBLIC_SITE_URL=https://fieldflow-tau.vercel.app
AWS_REGION=us-east-1
DYNAMODB_TABLE=FieldFlowRecordsV2
DYNAMODB_SORT_KEY_ENABLED=true
DYNAMODB_GSI1_NAME=gsi1
DYNAMODB_GSI2_NAME=gsi2
DYNAMODB_REQUIRE_COMPOSITE_KEY=true
DYNAMODB_SCAN_FALLBACK_ON_EMPTY_INDEX=false
AWS_S3_BUCKET=fieldflow-attachments-890608336900-us-east-1
S3_REGION=us-east-1
COGNITO_POOL_ID=...
COGNITO_CLIENT_ID=...
COGNITO_DOMAIN=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
DEEPSEEK_API_KEY=...
SESSION_SECRET=...
```

The repository template is [.env.example](../.env.example).

## Production Build

`npm run build` compiles Next.js and regenerates the PWA worker files under `public/`. Those worker hash changes are expected after source changes because `next-pwa` emits a new generated worker.

The custom worker source is [worker/index.js](../worker/index.js). The generated runtime files are committed so the PWA behavior is reproducible in deployment.

## AWS Resources

| Resource | Purpose |
| --- | --- |
| Cognito user pool | Signup, login, refresh, hosted OAuth, email verification, password reset, WebAuthn registration. |
| DynamoDB `FieldFlowRecordsV2` | Workspaces, users, workflows, records, mutations, conflicts, devices, inventory, audit, demo metrics. |
| S3 private bucket | Compressed photo evidence uploaded with presigned URLs. |

IAM used by Vercel must allow the Cognito admin/auth actions used by auth routes, DynamoDB read/write/query/transaction actions used by the data adapter, and S3 presign/upload-related object access for the configured bucket.

## Verification

Before merging a branch to production:

```bash
npm run lint
npm run build
```

Expected current lint state: zero errors, warnings only for remaining cleanup items such as unused variables and image/font recommendations.

For PWA/offline changes, test against a production build (`npm run build && npm run start`) because service worker behavior is disabled or different in development.

