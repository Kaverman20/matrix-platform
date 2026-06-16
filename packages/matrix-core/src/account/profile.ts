import type { MatrixClient } from "matrix-js-sdk";

export type AccountProfile = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  avatarMxc?: string;
};

export type SaveAccountProfileInput = {
  displayName: string;
  avatarFile?: File | null;
};

export async function getAccountProfile(
  client: MatrixClient,
): Promise<AccountProfile | null> {
  const userId = client.getUserId();
  if (!userId) return null;

  const info = await client.getProfileInfo(userId);
  return profileFromInfo(client, userId, info);
}

export async function saveAccountProfile(
  client: MatrixClient,
  current: AccountProfile,
  input: SaveAccountProfileInput,
): Promise<AccountProfile | null> {
  const displayName = input.displayName.trim();
  if (!displayName) return current;

  if (input.avatarFile) {
    const upload = await client.uploadContent(input.avatarFile, { type: input.avatarFile.type });
    const uri = typeof upload === "string" ? upload : (upload as { content_uri?: string }).content_uri;
    if (uri) await client.setAvatarUrl(uri);
  }
  if (displayName !== current.displayName) {
    await client.setDisplayName(displayName);
  }

  return getAccountProfile(client);
}

function profileFromInfo(
  client: MatrixClient,
  userId: string,
  info: { displayname?: string; avatar_url?: string },
): AccountProfile {
  const avatarMxc = info.avatar_url;
  return {
    userId,
    displayName: info.displayname || userId,
    avatarMxc,
    avatarUrl: avatarMxc
      ? client.mxcUrlToHttp(avatarMxc, 160, 160, "crop", false, true, true) ?? undefined
      : undefined,
  };
}
