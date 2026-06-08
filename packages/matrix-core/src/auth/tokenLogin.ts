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

  return {
    baseUrl,
    accessToken: accessToken.trim(),
    userId: who.user_id,
    deviceId: who.device_id ?? "",
  };
}

