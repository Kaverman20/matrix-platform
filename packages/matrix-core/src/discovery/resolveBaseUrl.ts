type WellKnownMatrixClient = {
  "m.homeserver"?: {
    base_url?: unknown;
  };
};

export async function resolveBaseUrl(input: string): Promise<string> {
  const serverName = input.trim();
  if (!serverName) throw new Error("Homeserver is required");

  if (/^https?:\/\//.test(serverName)) return trimTrailingSlash(serverName);

  try {
    const res = await fetch(`https://${serverName}/.well-known/matrix/client`);
    if (res.ok) {
      const data = (await res.json()) as WellKnownMatrixClient;
      const baseUrl = data["m.homeserver"]?.base_url;
      if (typeof baseUrl === "string" && baseUrl.trim()) {
        return trimTrailingSlash(baseUrl);
      }
    }
  } catch {
    // Missing .well-known is valid for self-hosted servers; fall back below.
  }

  return `https://${serverName}`;
}

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/$/, "");
}

