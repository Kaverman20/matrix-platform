# Foxhound Infrastructure

Current personal Matrix stack for Surf Chat.

## Domains

| Domain | Purpose |
|---|---|
| `matrix.foxhound.run` | Synapse homeserver and Matrix Client/Admin API |
| `chat.foxhound.run` | Surf Chat web client |
| `admin.foxhound.run` | Ketesa admin UI |

All three domains point to the VPS at `109.172.38.60`.

## Runtime

The current VPS stack lives under:

- `/opt/synapse-test/` — Synapse, PostgreSQL, Ketesa, Caddy
- `/opt/matrix-keycloak-sync/` — Keycloak group to Matrix access sync

Repository copies of the runtime manifests live under:

- `infra/foxhound/synapse-test/`
- `services/matrix-keycloak-sync/`

Runtime secrets are intentionally excluded. Use the `*.example` files as
templates for server-local `.env` / `config.env` files.

## Development Default

Local Surf Chat development should use:

```env
VITE_DEFAULT_HOMESERVER=https://matrix.foxhound.run
```

The old workspace currently has this value in `surf-chat/.env`.

## Access Model

- Login gate: `GR_chat_user` in the OIDC token.
- Mapping sync group paths use leading slash, for example `/GR_SSJR_ALL1`.
- Space access uses Matrix restricted rooms tied to parent Space membership.
