import { createClient } from "matrix-js-sdk";
import { resolveBaseUrl } from "../discovery/resolveBaseUrl";
import type { LoginResult } from "./types";

export async function loginWithAccessToken(
  homeserver: string,
  accessToken: string,
): Promise<LoginResult> {
  const baseUrl = await resolveBaseUrl(homeserver);
  const client = createClient({ baseUrl, accessToken: accessToken.trim() });
  const who = await client.whoami();

  // device_id namespaces the crypto store (см. crypto/encryption.ts). Пустой id
  // смешал бы хранилища разных устройств — лучше упасть, чем тихо сломать крипту.
  if (!who.device_id) {
    throw new Error("Access token has no associated device_id");
  }

  return {
    baseUrl,
    accessToken: accessToken.trim(),
    userId: who.user_id,
    deviceId: who.device_id,
  };
}

