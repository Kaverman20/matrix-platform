import { describe, expect, it } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { discoverRtcFoci } from "./discoverFoci";

const FOCUS = { type: "livekit", livekit_service_url: "https://rtc.example" };

function clientWith(wellKnown: unknown): MatrixClient {
  return {
    getClientWellKnown: () => wellKnown,
  } as unknown as MatrixClient;
}

describe("discoverRtcFoci", () => {
  it("returns the advertised LiveKit foci", async () => {
    const client = clientWith({ "org.matrix.msc4143.rtc_foci": [FOCUS] });
    await expect(discoverRtcFoci(client)).resolves.toEqual([FOCUS]);
  });

  it("returns empty when the server advertises no foci", async () => {
    const client = clientWith({ "m.homeserver": { base_url: "https://hs" } });
    await expect(discoverRtcFoci(client)).resolves.toEqual([]);
  });

  it("returns empty when there is no .well-known at all", async () => {
    const client = clientWith(undefined);
    await expect(discoverRtcFoci(client)).resolves.toEqual([]);
  });

  it("drops malformed entries (wrong type / missing url)", async () => {
    const client = clientWith({
      "org.matrix.msc4143.rtc_foci": [
        { type: "jitsi" },
        { type: "livekit" }, // no livekit_service_url
        FOCUS,
      ],
    });
    await expect(discoverRtcFoci(client)).resolves.toEqual([FOCUS]);
  });
})
