# Architecture

Matrix Platform is split into four layers:

1. Client applications in `apps/`.
2. Shared domain packages in `packages/`.
3. Backend services in `services/`.
4. Deployment and operations in `infra/`.

The Matrix protocol boundary belongs in `packages/matrix-core`.
UI features should depend on Matrix domain operations, not directly on low-level SDK details.

