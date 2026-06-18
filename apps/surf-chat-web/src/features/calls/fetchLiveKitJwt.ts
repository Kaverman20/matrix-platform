import type { MatrixClient } from "matrix-js-sdk";
import { discoverRtcFoci } from "@matrix-platform/matrix-core";

/** LiveKit SFU connection details returned by lk-jwt-service 0.3.x (`POST /sfu/get`). */
export type LiveKitCredentials = {
  wsUrl: string;
  jwt: string;
};

type OpenIdTokenResponse = {
  access_token: string;
  token_type: string;
  matrix_server_name: string;
};

type SfuGetResponse = {
  url: string;
  jwt: string;
};

type MatrixErrorBody = {
  errcode?: string;
  error?: string;
};

/**
 * Exchanges the logged-in Matrix session for a LiveKit JWT via lk-jwt-service.
 * Uses the legacy `POST /sfu/get` endpoint (lk-jwt 0.3.0 on foxhound).
 */
export async function fetchLiveKitCredentials(
  client: MatrixClient,
  roomId: string,
): Promise<LiveKitCredentials> {
  const userId = client.getUserId();
  const deviceId = client.getDeviceId();
  if (!userId || !deviceId) {
    throw new Error("Нет активной сессии Matrix");
  }

  const foci = await discoverRtcFoci(client);
  const focus = foci[0];
  if (!focus) {
    throw new Error("Homeserver не объявляет LiveKit focus (rtc_foci)");
  }

  const jwtBaseUrl = focus.livekit_service_url.replace(/\/$/, "");
  const openId = await requestOpenIdToken(client, userId);

  const res = await fetch(`${jwtBaseUrl}/sfu/get`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room: roomId,
      openid_token: {
        access_token: openId.access_token,
        token_type: openId.token_type,
        matrix_server_name: openId.matrix_server_name,
      },
      device_id: deviceId,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as MatrixErrorBody;
      detail = body.error ?? body.errcode ?? "";
    } catch {
      // ignore parse errors
    }
    throw new Error(detail ? `lk-jwt: ${detail}` : `lk-jwt: HTTP ${res.status}`);
  }

  const data = (await res.json()) as SfuGetResponse;
  if (!data.url || !data.jwt) {
    throw new Error("lk-jwt: неполный ответ (нет url или jwt)");
  }

  return { wsUrl: data.url, jwt: data.jwt };
}

async function requestOpenIdToken(
  client: MatrixClient,
  userId: string,
): Promise<OpenIdTokenResponse> {
  const accessToken = client.getAccessToken();
  if (!accessToken) throw new Error("Нет access token Matrix");

  const hsUrl = client.getHomeserverUrl().replace(/\/$/, "");
  const path = `/_matrix/client/v3/user/${encodeURIComponent(userId)}/openid/request_token`;

  const res = await fetch(`${hsUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: "{}",
  });

  if (!res.ok) {
    throw new Error(`OpenID token: HTTP ${res.status}`);
  }

  return (await res.json()) as OpenIdTokenResponse;
}
