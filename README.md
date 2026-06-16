# Matrix Platform

Corporate Matrix platform for Surf Chat.

This repository is the clean v2 workspace for:

- Surf Chat web client
- Matrix integration packages
- Access mapping services
- Deployment infrastructure
- Architecture and operational documentation

## Structure

```txt
apps/
  surf-chat-web/          User-facing Matrix web client (React + Vite)
packages/
  matrix-core/            Matrix SDK wrapper and domain operations
  ui/                     Shared UI primitives
services/                 Access-mapping services (Keycloak ↔ Matrix) — planned, stubs only
  mapping-api/            API for Keycloak group to Matrix target rules
  matrix-keycloak-sync/   Sync service applying access rules to Matrix
infra/                    Deployment infrastructure — mostly planned; foxhound/ mirrors the live VPS
  docker/  k8s/  synapse/  foxhound/
docs/
  architecture.md         Architecture overview
  migration-plan.md       Rebuild-from-donor plan
  DECISIONS.md            Engineering decision log (problem → cause → fix)
  decisions/              Architecture Decision Records (ADRs)
scripts/
  verify.sh               lint + typecheck + test + build
```

## Getting started

Requires pnpm and Node 24 (the version CI runs; 20+ should also work).

```sh
pnpm install
cp .env.example .env    # Vite reads env from the repo root (vite envDir: "../..")

# Run the web client
pnpm --filter surf-chat-web dev

# Build the web client for production
pnpm --filter surf-chat-web build
```

`.env` sets `VITE_DEFAULT_HOMESERVER` (default Matrix homeserver shown on the
login screen; users can still override it) and `VITE_APP_NAME`.

## Verifying

Run the full check (lint, typecheck, tests, build) before pushing:

```sh
pnpm verify    # or: scripts/verify.sh
```

Deployment of the web client to staging (chat.foxhound.run) is documented in
[docs/foxhound-infrastructure.md](docs/foxhound-infrastructure.md).

