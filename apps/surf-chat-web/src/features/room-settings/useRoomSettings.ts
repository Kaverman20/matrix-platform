import { useEffect, useState } from "react";
import { EventTimeline, type MatrixClient } from "matrix-js-sdk";

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
    const room = client.getRoom(targetRoomId);
    if (!room) return;

    const topicContent = room.currentState.getStateEvents("m.room.topic", "")?.getContent()?.topic;
    const avatarMxc = room.currentState.getStateEvents("m.room.avatar", "")?.getContent()?.url;

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setRoomId(targetRoomId);
    setIsSpace(room.isSpaceRoom());
    setName(room.name || "");
    setTopic(typeof topicContent === "string" ? topicContent : "");
    setCurrentAvatarUrl(
      typeof avatarMxc === "string"
        ? client.mxcUrlToHttp(avatarMxc, 96, 96, "crop", false, true, true) ?? undefined
        : undefined,
    );
    setAvatarFile(null);
    setAvatarPreview(null);
    setCanManage(canManageRoom(client, targetRoomId));
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
      const room = client.getRoom(roomId);
      const currentName = room?.name ?? "";
      const currentTopic =
        (room?.currentState.getStateEvents("m.room.topic", "")?.getContent()?.topic as string | undefined) ?? "";

      if (currentName !== trimmed) {
        await client.setRoomName(roomId, trimmed);
      }
      if (currentTopic !== topic.trim()) {
        await client.setRoomTopic(roomId, topic.trim());
      }
      if (avatarFile) {
        const upload = await client.uploadContent(avatarFile, { type: avatarFile.type });
        const uri = (upload as { content_uri?: string }).content_uri;
        if (uri) {
          await client.sendStateEvent(roomId, "m.room.avatar" as never, { url: uri } as never, "");
        }
      }
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

/** True when the user may edit room name/topic/avatar (power level check). */
export function canManageRoom(client: MatrixClient, roomId: string): boolean {
  const room = client.getRoom(roomId);
  if (!room) return false;

  const powerLevels = room
    .getLiveTimeline()
    .getState(EventTimeline.FORWARDS)
    ?.getStateEvents("m.room.power_levels", "")
    ?.getContent() as
      | { users?: Record<string, number>; users_default?: number; events?: Record<string, number>; state_default?: number }
      | undefined;

  const me = client.getUserId();
  const myLevel = Number((me && powerLevels?.users?.[me]) ?? powerLevels?.users_default ?? 0);
  const required = Number(powerLevels?.events?.["m.room.name"] ?? powerLevels?.state_default ?? 50);
  return myLevel >= required;
}
