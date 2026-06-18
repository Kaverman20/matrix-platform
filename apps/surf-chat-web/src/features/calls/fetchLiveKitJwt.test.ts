import { describe, expect, it, vi, afterEach } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { fetchLiveKitCredentials } from "./fetchLiveKitJwt";

const FOCUS = { type: "livekit", livekit_service_url: "https://rtc.example" };

function fakeClient(): MatrixClient {
  return {
    getUserId: () => "@alice:hs",
    getDeviceId: () => "DEVICE",
    getAccessToken: () => "matrix_access",
    getHomeserverUrl: () => "https://matrix.hs",
    getClientWellKnown: () => ({ "org.matrix.msc4143.rtc_foci": [FOCUS] }),
  } as unknown as MatrixClient;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchLiveKitCredentials", () => {
  it("requests OpenID then POSTs /sfu/get and returns ws url + jwt", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "oid_access",
          token_type: "Bearer",
          matrix_server_name: "hs",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "wss://rtc.example", jwt: "lk_jwt" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchLiveKitCredentials(fakeClient(), "!room:hs");

    expect(result).toEqual({ wsUrl: "wss://rtc.example", jwt: "lk_jwt" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [openidUrl, openidInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(openidUrl).toBe(
      "https://matrix.hs/_matrix/client/v3/user/%40alice%3Ahs/openid/request_token",
    );
    expect(openidInit.method).toBe("POST");

    const [sfuUrl, sfuInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(sfuUrl).toBe("https://rtc.example/sfu/get");
    expect(JSON.parse(String(sfuInit.body))).toEqual({
      room: "!room:hs",
      openid_token: {
        access_token: "oid_access",
        token_type: "Bearer",
        matrix_server_name: "hs",
      },
      device_id: "DEVICE",
    });
  });

  it("throws when rtc_foci is missing", async () => {
    const client = {
      ...fakeClient(),
      getClientWellKnown: () => ({}),
    } as unknown as MatrixClient;
    await expect(fetchLiveKitCredentials(client, "!room:hs")).rejects.toThrow(/rtc_foci/i);
  });
});
