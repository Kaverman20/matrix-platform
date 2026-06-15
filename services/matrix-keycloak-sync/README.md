# Matrix Keycloak Sync

Service that applies Keycloak group membership to Matrix Spaces/Rooms.

The live server path is:

```bash
/opt/matrix-keycloak-sync
```

Secrets live in `config.env` and must not be committed. Use `config.env.example`
as the template.

## Local/Server Usage

```bash
cp config.env.example config.env
docker compose up -d --build
```

Run once without applying changes:

```bash
docker compose run --rm matrix-keycloak-sync python sync.py --dry-run
```

The `mapping.yaml` file maps Keycloak group paths to Matrix room IDs.

