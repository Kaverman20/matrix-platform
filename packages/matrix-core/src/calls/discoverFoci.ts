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
 * `org.matrix.msc4143.rtc_foci`. Returns an empty array when the server hasn't
 * been configured for RTC yet (Stage 0 not deployed), which callers should treat
 * as "calls unavailable" rather than an error.
 */
export async function discoverRtcFoci(client: MatrixClient): Promise<RtcFocus[]> {
  // Relies on the `.well-known` the SDK parsed and cached at login. If a future
  // login path leaves this unpopulated we'll add a direct fetch here, but for
  // now an empty/missing config correctly reads as "calls unavailable".
  const clientConfig = client.getClientWellKnown?.() as
    | Record<string, unknown>
    | undefined;

  const raw = clientConfig?.[RTC_FOCI_KEY];
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
