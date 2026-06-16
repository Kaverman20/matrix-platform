import { useEffect, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  getRoomSettingsSnapshot,
  saveRoomSettings,
} from "@matrix-platform/matrix-core";

type Options = {
  client: MatrixClient | null;
};

/**
 * Settings for a room or space: rename, topic, avatar. Works on any room
 * (a space is just a room), gated by the caller's power level.
 */
export function useRoomSettings({ client }: Options) {
  const [open, setOpen] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isSpace, setIsSpace] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | undefined>(undefined);
  const [canManage, setCanManage] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const openSettings = (targetRoomId: string) => {
    if (!client) return;
    const settings = getRoomSettingsSnapshot(client, targetRoomId);
    if (!settings) return;

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setRoomId(targetRoomId);
    setIsSpace(settings.isSpace);
    setName(settings.name);
    setTopic(settings.topic);
    setCurrentAvatarUrl(settings.currentAvatarUrl);
    setAvatarFile(null);
    setAvatarPreview(null);
    setCanManage(settings.canManage);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setPending(false);
  };

  const setAvatar = (file: File | null) => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!client || !roomId || !trimmed || pending || !canManage) return;

    setPending(true);
    try {
      await saveRoomSettings(client, roomId, { name: trimmed, topic, avatarFile });
      close();
    } catch (error) {
      console.error("[room-settings]", error);
      window.alert("Не удалось сохранить настройки.");
    } finally {
      setPending(false);
    }
  };

  return {
    open,
    isSpace,
    name,
    setName,
    topic,
    setTopic,
    avatarPreview,
    currentAvatarUrl,
    canManage,
    pending,
    openSettings,
    close,
    setAvatar,
    save,
  };
}

export type RoomSettings = ReturnType<typeof useRoomSettings>;
