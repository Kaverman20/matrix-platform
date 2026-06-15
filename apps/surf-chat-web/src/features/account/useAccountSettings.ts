import { useCallback, useEffect, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";

export type AccountProfile = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  avatarMxc?: string;
};

type Options = {
  client: MatrixClient | null;
};

export function useAccountSettings({ client }: Options) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const loadProfile = useCallback(async () => {
    if (!client) return;
    const userId = client.getUserId();
    if (!userId) return;

    const info = await client.getProfileInfo(userId);
    const nextProfile = profileFromInfo(client, userId, info);
    setProfile(nextProfile);
    setDisplayName(nextProfile.displayName);
  }, [client]);

  const openSettings = useCallback(() => {
    setOpen(true);
    setError(null);
    void loadProfile();
  }, [loadProfile]);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setDisplayName(profile?.displayName ?? "");
  }, [avatarPreview, profile?.displayName]);

  const setAvatar = useCallback((file: File | null) => {
    setAvatarFile(file);
    setAvatarPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
  }, []);

  const save = useCallback(async () => {
    if (!client || !profile) return;
    const name = displayName.trim();
    if (!name) return;

    setPending(true);
    setError(null);
    try {
      if (avatarFile) {
        const upload = await client.uploadContent(avatarFile, { type: avatarFile.type });
        const uri = typeof upload === "string" ? upload : (upload as { content_uri?: string }).content_uri;
        if (uri) await client.setAvatarUrl(uri);
      }
      if (name !== profile.displayName) {
        await client.setDisplayName(name);
      }
      await loadProfile();
      setAvatar(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить профиль");
    } finally {
      setPending(false);
    }
  }, [avatarFile, client, displayName, loadProfile, profile, setAvatar]);

  useEffect(() => {
    if (!client) return;
    const timer = window.setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [client, loadProfile]);

  return {
    open,
    openSettings,
    close,
    profile,
    displayName,
    setDisplayName,
    avatarPreview,
    setAvatar,
    pending,
    error,
    save,
  };
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
