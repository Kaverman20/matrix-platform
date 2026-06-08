import { createClient } from "matrix-js-sdk";
import { DEFAULT_DEVICE_DISPLAY_NAME } from "../constants";
import { resolveBaseUrl } from "../discovery/resolveBaseUrl";
import type { LoginOptions, LoginResult } from "./types";

export async function loginWithPassword(
  homeserver: string,
  user: string,
  password: string,
  options: LoginOptions = {},
): Promise<LoginResult> {
  const baseUrl = await resolveBaseUrl(homeserver);
  const client = createClient({ baseUrl });
  const res = await client.loginRequest({
    type: "m.login.password",
    identifier: { type: "m.id.user", user },
    password,
    initial_device_display_name:
      options.deviceDisplayName ?? DEFAULT_DEVICE_DISPLAY_NAME,
  });

  return {
    baseUrl,
    accessToken: required(res.access_token, "access_token"),
    userId: required(res.user_id, "user_id"),
    deviceId: required(res.device_id, "device_id"),
  };
}

function required(value: string | undefined, field: string): string {
  if (!value) throw new Error(`Matrix login response is missing ${field}`);
  return value;
}

