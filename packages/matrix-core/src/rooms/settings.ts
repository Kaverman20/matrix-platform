import { type MatrixClient } from "matrix-js-sdk";
import { getRoomStateContent } from "../util/roomState";

type PowerLevelsContent = {
  users?: Record<string, number>;
  users_default?: number;
  events?: Record<string, number>;
  state_default?: number;
};

export type MatrixRoomSettingsSnapshot = {
  roomId: string;
  isSpace: boolean;
  name: string;
  topic: string;
  currentAvatarUrl?: string;
  canManage: boolean;
};

export type SaveRoomSettingsInput = {
  name: string;
  topic: string;
  avatarFile?: File | null;
};

export function getRoomSettingsSnapshot(
  client: MatrixClient,
  roomId: string,
): MatrixRoomSettingsSnapshot | null {
  const room = client.getRoom(roomId);
  if (!room) return null;

  const topic = getRoomStateContent<{ topic?: unknown }>(room, "m.room.topic")?.topic;
  const avatarMxc = getRoomStateContent<{ url?: unknown }>(room, "m.room.avatar")?.url;

  return {
    roomId,
    isSpace: room.isSpaceRoom(),
    name: room.name || "",
    topic: typeof topic === "string" ? topic : "",
    currentAvatarUrl: typeof avatarMxc === "string"
      ? client.mxcUrlToHttp(avatarMxc, 96, 96, "crop", false, true, true) ?? undefined
      : undefined,
    canManage: canManageRoom(client, roomId),
  };
}

export async function saveRoomSettings(
  client: MatrixClient,
  roomId: string,
  input: SaveRoomSettingsInput,
): Promise<void> {
  const name = input.name.trim();
  if (!name) return;

  const room = client.getRoom(roomId);
  const currentName = room?.name ?? "";
  const currentTopic =
    (getRoomStateContent<{ topic?: unknown }>(room, "m.room.topic")?.topic as string | undefined) ?? "";
  const nextTopic = input.topic.trim();

  if (currentName !== name) {
    await client.setRoomName(roomId, name);
  }
  if (currentTopic !== nextTopic) {
    await client.setRoomTopic(roomId, nextTopic);
  }
  if (input.avatarFile) {
    const upload = await client.uploadContent(input.avatarFile, { type: input.avatarFile.type });
    const uri = typeof upload === "string" ? upload : (upload as { content_uri?: string }).content_uri;
    if (uri) {
      await client.sendStateEvent(roomId, "m.room.avatar" as never, { url: uri } as never, "");
    }
  }
}

/** True when the user may edit room name/topic/avatar (power level check). */
export function canManageRoom(client: MatrixClient, roomId: string): boolean {
  const room = client.getRoom(roomId);
  if (!room) return false;

  const powerLevels = getRoomStateContent<PowerLevelsContent>(room, "m.room.power_levels");
  const me = client.getUserId();
  const myLevel = Number((me && powerLevels?.users?.[me]) ?? powerLevels?.users_default ?? 0);
  const required = Number(powerLevels?.events?.["m.room.name"] ?? powerLevels?.state_default ?? 50);
  return myLevel >= required;
}
