type WellKnownMatrixClient = {
  "m.homeserver"?: {
    base_url?: unknown;
  };
};

export async function resolveBaseUrl(input: string): Promise<string> {
  const serverName = input.trim();
  if (!serverName) throw new Error("Homeserver is required");

  if (/^https?:\/\//.test(serverName)) return assertHttpUrl(trimTrailingSlash(serverName));

  try {
    const res = await fetch(`https://${serverName}/.well-known/matrix/client`);
    if (res.ok) {
      const data = (await res.json()) as WellKnownMatrixClient;
      const baseUrl = data["m.homeserver"]?.base_url;
      if (typeof baseUrl === "string" && baseUrl.trim()) {
        // base_url comes from a remote .well-known — reject anything that isn't
        // a plain http(s) URL (e.g. javascript:, data:) before we trust it.
        return assertHttpUrl(trimTrailingSlash(baseUrl));
      }
    }
  } catch {
    // Missing .well-known is valid for self-hosted servers; fall back below.
  }

  return `https://${serverName}`;
}

/** Throws unless `value` is a syntactically valid http(s) URL. */
export function assertHttpUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid homeserver URL: ${value}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported homeserver URL scheme: ${parsed.protocol}`);
  }
  return value;
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/$/, "");
}

