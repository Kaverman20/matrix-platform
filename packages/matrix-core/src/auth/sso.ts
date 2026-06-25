import { createClient } from "matrix-js-sdk";
import { DEFAULT_DEVICE_DISPLAY_NAME } from "../constants";
import { resolveBaseUrl } from "../discovery/resolveBaseUrl";
import type { LoginOptions, LoginResult, SsoIdentityProvider } from "./types";

// Разрешённые схемы redirectUrl для SSO. Только http(s): веб отдаёт свой origin,
// десктоп — loopback http://127.0.0.1 (RFC 8252), куда токен принимает локальный
// сервер самой оболочки. Custom-схемы запрещены (перехватываемы другими прилож.).
const ALLOWED_SSO_REDIRECT_SCHEMES = new Set(["https:", "http:"]);

type LoginFlowResponse = {
  flows?: Array<{
    type?: string;
    identity_providers?: Array<{
      id: string;
      name?: string;
    }>;
  }>;
};

export async function getSsoIdentityProviders(
  homeserver: string,
): Promise<SsoIdentityProvider[]> {
  const baseUrl = await resolveBaseUrl(homeserver);
  const res = await fetch(`${baseUrl}/_matrix/client/v3/login`);
  if (!res.ok) return [];

  const data = (await res.json()) as LoginFlowResponse;
  const flow = data.flows?.find((item) => item.type === "m.login.sso");

  return (
    flow?.identity_providers?.map((provider) => ({
      id: provider.id,
      name: provider.name ?? provider.id,
    })) ?? []
  );
}

export async function buildSsoRedirectUrl(
  homeserver: string,
  idpId: string | null,
  redirectUrl: string,
): Promise<string> {
  // The homeserver receives redirectUrl and sends the loginToken back to it,
  // so an attacker-controlled value is an open-redirect / token-theft vector.
  // Allow только plain http(s) (веб отдаёт свой origin) и нашу фиксированную
  // схему десктоп-оболочки surfchat:// (deep-link возврата токена в Electron).
  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(redirectUrl);
  } catch {
    throw new Error(`Invalid SSO redirectUrl: ${redirectUrl}`);
  }
  if (!ALLOWED_SSO_REDIRECT_SCHEMES.has(parsedRedirect.protocol)) {
    throw new Error(`Unsupported SSO redirectUrl scheme: ${parsedRedirect.protocol}`);
  }

  const baseUrl = await resolveBaseUrl(homeserver);
  const path = idpId
    ? `/_matrix/client/v3/login/sso/redirect/${encodeURIComponent(idpId)}`
    : "/_matrix/client/v3/login/sso/redirect";

  return `${baseUrl}${path}?redirectUrl=${encodeURIComponent(redirectUrl)}`;
}

export async function loginWithLoginToken(
  homeserver: string,
  loginToken: string,
  options: LoginOptions = {},
): Promise<LoginResult> {
  const baseUrl = await resolveBaseUrl(homeserver);
  const client = createClient({ baseUrl });
  const res = await client.loginRequest({
    type: "m.login.token",
    token: loginToken,
    initial_device_display_name:
      options.deviceDisplayName ?? DEFAULT_DEVICE_DISPLAY_NAME,
  } as never);

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

