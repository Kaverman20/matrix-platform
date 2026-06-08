# 0001. Start A Clean Platform Repository

## Status

Accepted

## Context

The original `Matrix x Element` workspace contains experiments, an Element Web fork,
the first Surf Chat client, Synapse test infrastructure, Keycloak sync services, and
deployment notes. That was useful during discovery, but it mixes product code with
legacy exploration.

## Decision

Create a new `matrix-platform` workspace and migrate only proven pieces into it.

## Consequences

- The old workspace remains a reference and donor.
- New code starts with explicit package and feature boundaries.
- CI, docs, and deployment structure are part of the repository from the beginning.

