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
  surf-chat-web/          User-facing Matrix web client
services/
  mapping-api/            API for Keycloak group to Matrix target rules
  matrix-keycloak-sync/   Sync service applying access rules to Matrix
packages/
  matrix-core/            Matrix SDK wrapper and domain operations
  ui/                     Shared UI primitives
  shared/                 Shared types and utilities
  config/                 Shared tooling config
infra/
  docker/
  k8s/
  synapse/
docs/
  decisions/
scripts/
```

## First Milestones

1. Scaffold `apps/surf-chat-web`.
2. Move stable Matrix auth/session logic into `packages/matrix-core`.
3. Rebuild the chat shell feature by feature.
4. Keep CI green from the first commit.

