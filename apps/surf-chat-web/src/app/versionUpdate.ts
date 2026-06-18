export const BUILD_ID_PATH = "/build-id.txt";

export function isRemoteBuildNewer(remoteBuildId: string, currentBuildId: string): boolean {
  const remote = remoteBuildId.trim();
  const current = currentBuildId.trim();
  if (!remote || !current) return false;
  return remote !== current;
}

export async function fetchRemoteBuildId(path = BUILD_ID_PATH): Promise<string | null> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return null;
    const text = (await response.text()).trim();
    return text || null;
  } catch {
    return null;
  }
}
