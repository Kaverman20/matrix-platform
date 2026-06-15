# Foxhound Synapse Runtime

Runtime compose stack for the current `matrix.foxhound.run` VPS.

The live server path is:

```bash
/opt/synapse-test
```

This stack runs:

- Synapse homeserver
- PostgreSQL
- Caddy with automatic TLS
- Ketesa admin UI
- Surf Chat static build mounted at `./surfchat-dist`

## Setup

```bash
cd /opt/synapse-test
cp .env.example .env
```

Set `POSTGRES_PASSWORD` in `.env`, then generate Synapse config:

```bash
docker compose run --rm synapse generate
```

Edit `data/synapse/homeserver.yaml` and use PostgreSQL:

```yaml
database:
  name: psycopg2
  args:
    user: synapse
    password: THE_SAME_PASSWORD_AS_IN_ENV
    dbname: synapse
    host: postgres
    cp_min: 5
    cp_max: 10
```

Start:

```bash
docker compose up -d
```

Check:

```bash
curl https://matrix.foxhound.run/_matrix/client/versions
```

## Deploy Surf Chat

Build locally:

```bash
pnpm --filter @matrix-platform/surf-chat-web build
```

Upload the built static files:

```bash
rsync -av --delete apps/surf-chat-web/dist/ root@109.172.38.60:/opt/synapse-test/surfchat-dist/
```

## Operations

```bash
docker compose ps
docker compose logs -f synapse
docker compose logs -f caddy
docker compose restart synapse
```

Do not commit `.env`, `data/`, generated Synapse keys, PostgreSQL data, or `surfchat-dist`.

