import type { MatrixClient } from "matrix-js-sdk";
import type { LivekitTransportConfig } from "matrix-js-sdk/lib/matrixrtc";

/**
 * A LiveKit focus the homeserver advertises for MatrixRTC. This is the shape of
 * each entry under `org.matrix.msc4143.rtc_foci` in `/.well-known/matrix/client`,
 * and exactly what `MatrixRTCSession.joinRoomSession(fociPreferred, ...)` expects.
 */
export type RtcFocus = LivekitTransportConfig;

const RTC_FOCI_KEY = "org.matrix.msc4143.rtc_foci";

/**
 * Reads the LiveKit foci the homeserver advertises via `.well-known`.
 *
 * MatrixRTC clients don't hardcode the SFU — they discover it from the server's
 * `org.matrix.msc4143.rtc_foci`. We first use the `.well-known` the SDK parsed,
 * then fall back to fetching it directly: when a session logs in straight
 * against the homeserver URL (no domain autodiscovery), `getClientWellKnown()`
 * is empty even though the server serves the foci. Returns an empty array when
 * the server advertises none (calls unavailable) rather than throwing.
 */
export async function discoverRtcFoci(client: MatrixClient): Promise<RtcFocus[]> {
  const cached = client.getClientWellKnown?.() as Record<string, unknown> | undefined;
  const fromCache = extractFoci(cached?.[RTC_FOCI_KEY]);
  if (fromCache.length > 0) return fromCache;

  try {
    const base = client.getHomeserverUrl?.()?.replace(/\/$/, "");
    if (!base) return [];
    const res = await fetch(`${base}/.well-known/matrix/client`);
    if (!res.ok) return [];
    const json = (await res.json()) as Record<string, unknown>;
    return extractFoci(json[RTC_FOCI_KEY]);
  } catch {
    return [];
  }
}

function extractFoci(raw: unknown): RtcFocus[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isLivekitFocus);
}

function isLivekitFocus(value: unknown): value is RtcFocus {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "livekit" &&
    typeof (value as { livekit_service_url?: unknown }).livekit_service_url === "string"
  );
}
