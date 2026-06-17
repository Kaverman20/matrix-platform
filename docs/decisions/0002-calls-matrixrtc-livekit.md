# 0002. Calls via MatrixRTC + LiveKit with an in-house CallPanel

## Status

Accepted

## Context

Surf Chat needs voice/video calls. Today only inert Phone/Video buttons exist in
the chat header. We must choose a call architecture.

In the Matrix ecosystem (2025–2026) the legacy 1:1 VoIP path (`m.call.*` + P2P
WebRTC) is effectively dead and poorly supported in Synapse/SDK. The current path
is **MatrixRTC (MSC4143) + LiveKit SFU**, with Element Call as the reference
client. Element no longer offers a free hosted backend, so a self-hosted LiveKit
+ `lk-jwt-service` is required.

We will need group conferences eventually, but want **1:1 calls first**.

## Decision

- **Architecture:** MatrixRTC (`matrix-js-sdk` `MatrixRTCSession`) for signalling
  + LiveKit (`livekit-client`) for media. Build our **own `CallPanel`**; Element
  Call does **not** ship in the product.
- **1:1 first, same stack:** a 1:1 call is a 2-person room session. LiveKit is not
  overkill for two — one media path, fewer NAT edge cases than P2P, and the same
  code scales to channels later. We do **not** use `m.call` (would be throwaway).
- **MVP scope (v1):** DM rooms only, audio-first (video toggle later), **in-app
  ring** (banner + Join, no push), **no call E2EE**.
- **Element Call as a smoke-test only:** deploy it temporarily at
  `call.foxhound.run` to prove the backend, then remove it. It is a diagnostic,
  not a dependency.
- **Boundaries:** `matrix-core/src/calls` is React/media-free (Matrix membership
  only); `livekit-client` lives only in `apps/surf-chat-web/features/calls`.
- **Feature flag:** `VITE_CALLS_ENABLED`, off until the Stage 0 backend is
  smoke-tested.
- **Domains:** `matrix-rtc.foxhound.run` (LiveKit WS + `lk-jwt-service`);
  temporary `call.foxhound.run` (smoke).

## Stages

0. Infra (LiveKit + lk-jwt + `.well-known` `rtc_foci` + Synapse MSCs + Caddy + Permissions-Policy).
0.5. Smoke-test (Element Call or `curl`) — backend proven before any client code.
1. Core: `joinCall` / `leaveCall` on `MatrixRTCSession` + join/leave tests.
2. UI: `CallPanel` connects LiveKit, mute, hangup.
3. DM wire-up: Phone button when `room.kind === "dm"` + in-app ring listener.
4. Later: video by default, push/VoIP ringing, screen share, channels (groups), call E2EE.

## Consequences / constraints

- **Unstable API:** the `matrixrtc` API in `matrix-js-sdk` is unstable. We pin
  `matrix-js-sdk@41.7.0` (resolves to `41.7.0-rc.3` in the lockfile),
  `livekit-client`, and the `lk-jwt-service` image tag, and treat them as a unit
  — an SDK bump requires re-running the call join/leave regression tests.
  (Verified against the installed `41.7.0-rc.3`:
  `client.matrixRTC.getRoomSession(room)`,
  `session.joinRoomSession(fociPreferred: Transport[], multiSfuFocus?, joinConfig?)`,
  `session.leaveRoomSession(timeout?)`.)
- **`joinRoomSession` is deprecated** in this SDK version (it builds a temporary
  `userId:deviceId` member id and delegates to `joinRTCSession`). The skeleton
  uses it for simplicity; Stage 2 should migrate to `joinRTCSession` with an
  explicit `memberId` once media is wired.
- **No E2EE on calls in v1:** media flows through the SFU and is **not**
  end-to-end encrypted at the application layer (no `manageMediaKeys`). DM *text*
  may be E2EE while *voice* is not — acceptable inside the corporate VPC, but it
  must be stated so security expectations don't diverge. Call E2EE is a post-MVP
  stage.
- **No `m.call`.** No P2P-mesh.
- **TURN/coturn:** not in the MVP. LiveKit handles TURN/ICE via its own config; a
  standalone coturn is Plan B only if a participant behind strict NAT has no audio.
- **Firewall:** LiveKit's UDP media range (+ TCP fallback) must be opened on both
  the host firewall and any cloud-provider firewall. Ports = exactly what's in the
  LiveKit config. This is the most common "connected but no audio" cause.
- **Permissions-Policy, not just CSP:** camera/mic are gated by
  `Permissions-Policy: camera=(self), microphone=(self)`. With our own UI (no
  iframe) we do not need iframe `allow` or `frame-src`; we do need LiveKit in
  `connect-src`.
- **CI:** MatrixRTC is mocked in vitest; LiveKit is never started in CI.
- **Deploy:** infra files live in the repo as templates; the live `homeserver.yaml`
  and filled secrets stay on the VPS and are applied by hand over SSH.
