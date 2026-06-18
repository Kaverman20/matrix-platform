import { afterEach, describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { discoverRtcFoci } from "./discoverFoci";

const FOCUS = { type: "livekit", livekit_service_url: "https://rtc.example" };

function clientWith(
  wellKnown: unknown,
  homeserverUrl = "https://matrix.example",
): MatrixClient {
  return {
    getClientWellKnown: () => wellKnown,
    getHomeserverUrl: () => homeserverUrl,
  } as unknown as MatrixClient;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("discoverRtcFoci", () => {
  it("returns the foci from the SDK-parsed .well-known", async () => {
    const client = clientWith({ "org.matrix.msc4143.rtc_foci": [FOCUS] });
    await expect(discoverRtcFoci(client)).resolves.toEqual([FOCUS]);
  });

  it("drops malformed entries (wrong type / missing url)", async () => {
    const client = clientWith({
      "org.matrix.msc4143.rtc_foci": [{ type: "jitsi" }, { type: "livekit" }, FOCUS],
    });
    await expect(discoverRtcFoci(client)).resolves.toEqual([FOCUS]);
  });

  it("falls back to fetching .well-known when the cache lacks foci", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ "org.matrix.msc4143.rtc_foci": [FOCUS] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = clientWith({ "m.homeserver": { base_url: "https://hs" } });
    await expect(discoverRtcFoci(client)).resolves.toEqual([FOCUS]);
    expect(fetchMock).toHaveBeenCalledWith("https://matrix.example/.well-known/matrix/client");
  });

  it("returns empty when neither cache nor fetched .well-known has foci", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const client = clientWith(undefined);
    await expect(discoverRtcFoci(client)).resolves.toEqual([]);
  });

  it("returns empty (no throw) when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const client = clientWith(undefined);
    await expect(discoverRtcFoci(client)).resolves.toEqual([]);
  });
});
