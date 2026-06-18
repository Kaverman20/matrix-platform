# matrix-rtc — MatrixRTC media backend (Stage 0)

Self-hosted media backend for Surf Chat 1:1 calls: **LiveKit SFU** +
**lk-jwt-service**, discovered by clients via MatrixRTC (MSC4143). Rationale and
scope are in [ADR 0002](../../../docs/decisions/0002-calls-matrixrtc-livekit.md).

These files are **templates, no secrets**. Deployment is applied by hand on the
foxhound VPS over SSH (live `homeserver.yaml` and the filled `.env` are never
committed).

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | LiveKit + lk-jwt-service (coturn = commented Plan B) |
| `livekit.example.yaml` | LiveKit config — copy to `livekit.yaml`, set keys + ports |
| `.env.example` | API key/secret + WS URL — copy to `.env` |
| `Caddyfile.fragment` | `matrix-rtc.foxhound.run` block + required `chat.foxhound.run` header changes |
| `well-known.example.json` | `org.matrix.msc4143.rtc_foci` to merge into the live `.well-known` |
| `homeserver.snippet.yaml` | Synapse MSC flags to merge into the live `homeserver.yaml` |
| `SMOKE.md` | Stage 0.5 checklist — prove the backend before writing call code |

## Networking (read before deploy)

Two compose stacks run on the same VPS:

| Stack | Path | Key services |
|-------|------|--------------|
| **synapse-test** | `infra/foxhound/synapse-test/` | Synapse, Caddy (TLS), Surf Chat static |
| **matrix-rtc** | `infra/foxhound/matrix-rtc/` | LiveKit (host network), lk-jwt |

LiveKit uses `network_mode: host` so UDP media ports are reachable directly.
lk-jwt publishes **`8080:8080`** on the host (не `127.0.0.1:8080` — иначе Caddy
через `host.docker.internal` не достучится).

Caddy runs **inside** the synapse-test compose network. It cannot resolve
`livekit:7880` or `lk-jwt-service:8080` from the matrix-rtc stack.

**Solution:** Caddy proxies to `host.docker.internal:7880` (LiveKit) and
`host.docker.internal:8080` (lk-jwt). The caddy service needs:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

This is already in `synapse-test/docker-compose.yml`. After changing it, recreate
the caddy container: `docker compose up -d caddy`.

## Deploy order

1. Fill `livekit.yaml` + `.env` on the VPS (generate LiveKit keys).
2. Open `rtc.port_range_start`–`rtc.port_range_end` and `rtc.tcp_port` on host
   **and** cloud firewall.
3. Merge `homeserver.snippet.yaml` → live `homeserver.yaml`, restart Synapse.
4. Настроить `/.well-known/matrix/client` — см. комментарий в
   `well-known.example.json` (на foxhound: статический `respond` в Caddy, не Synapse).
5. Add `Caddyfile.fragment` blocks to synapse-test `Caddyfile`; apply the
   `chat.foxhound.run` header changes from the fragment comments.
6. Confirm caddy `extra_hosts` (see Networking above).
7. `docker compose up -d` in **matrix-rtc/**.
8. Run [`SMOKE.md`](./SMOKE.md) top to bottom.

> Pin image tags. MatrixRTC is unstable — LiveKit, lk-jwt-service and
> `matrix-js-sdk` must be upgraded together with regression tests.
>
> На **lk-jwt 0.3.0** JWT выдаётся через **`POST /sfu/get`** (`/get_token` в этой
> версии отвечает 404). В более новых версиях lk-jwt появится MSC4195 `/get_token` —
> при апгрейде сверяй release notes и обновляй клиент.
