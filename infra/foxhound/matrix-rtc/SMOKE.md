# Stage 0.5 — RTC backend smoke test

Goal: prove the **infra** is correct before writing/debugging any Surf Chat call
code. Run these top to bottom on the VPS / from a browser. Stop at the first
failure — each step gates the next.

## 0. Firewall (do this FIRST — silent failure if skipped)

The LiveKit UDP media range and TCP fallback from `livekit.yaml` must be open on
**both** layers:

- [ ] **Host firewall** (e.g. `ufw status` shows the UDP range + TCP port open)
- [ ] **Cloud firewall** (Hetzner / DO / provider panel — separate from `ufw`)

Use the exact ports from your `livekit.yaml` (`rtc.port_range_start` /
`rtc.port_range_end`, `rtc.tcp_port`), not the template defaults.

## 1. Services up

- [ ] `docker compose ps` (in `matrix-rtc/`) — `livekit` and `lk-jwt-service` are `running`
- [ ] Caddy has `extra_hosts: host.docker.internal:host-gateway` (synapse-test compose)
- [ ] `curl -fsS https://matrix-rtc.foxhound.run/healthz` → 200 (lk-jwt alive)
- [ ] `curl -s -o /dev/null -w '%{http_code}' https://matrix-rtc.foxhound.run/sfu/get` → 405
      (lk-jwt 0.3.0 JWT endpoint; POST-only, so GET = 405 means alive. NOTE:
      /get_token returns 404 on 0.3.0 — expected, the working endpoint is /sfu/get.)

## 2. Discovery (.well-known)

- [ ] `curl -fsS https://matrix.foxhound.run/.well-known/matrix/client | jq '."org.matrix.msc4143.rtc_foci"'`
      returns the LiveKit focus (type `livekit`, correct `livekit_service_url`)

## 3. lk-jwt ↔ Synapse OpenID

- [ ] From the `lk-jwt-service` container, the homeserver `/_matrix` endpoint is
      reachable (OpenID userinfo). If JWTs aren't issued, this is the usual cause.
- [ ] Synapse restarted after applying `homeserver.snippet.yaml`
      (msc3266 / msc4222 / msc4140 enabled).

## 4. LiveKit WS reachable from the app origin

- [ ] `wss://matrix-rtc.foxhound.run` upgrades (not blocked by CSP/CORS from
      `chat.foxhound.run`). Check the browser console for CSP `connect-src` errors.

## 5. End-to-end media (the real proof)

Deploy Element Call temporarily at `call.foxhound.run`, then:

- [ ] Open the **same DM room** in two browsers / two accounts
- [ ] Start a call in both
- [ ] **You actually HEAR audio both ways** (not just "connected" in the UI)

If steps 1–4 pass but 5 has no audio → re-check **step 0** (UDP/firewall).

## 6. Cleanup

- [ ] **Remove** the `call.foxhound.run` block from Caddy (or close behind
      basic auth). It is a diagnostic, not a product surface.

---

Once all boxes are checked, the backend is good: any further call bug is in
Surf Chat client code, not the infra. Proceed to Stage 2 (LiveKit in `useRoomCall`).
