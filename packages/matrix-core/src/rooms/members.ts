import { type MatrixClient } from "matrix-js-sdk";
import { getRoomStateContent } from "../util/roomState";

type PowerLevelsContent = {
  users?: Record<string, number>;
  users_default?: number;
  events?: Record<string, number>;
  events_default?: number;
  invite?: number;
  kick?: number;
  ban?: number;
};

export type RoomMemberPermissions = {
  canInvite: boolean;
  canKick: boolean;
  myPowerLevel: number;
};

export type RoomSendPermission =
  | { canSend: true }
  | { canSend: false; reason: "banned" | "left" | "no-permission" | "tombstoned" };

/**
 * Whether the current user may post a normal message into the room. Mirrors how
 * Synapse gates sending: membership must be `join`, the room must not be
 * tombstoned (replaced), and the user's power level must clear the
 * `m.room.message` event threshold (announcement channels raise this so only
 * moderators post).
 */
export function getRoomSendPermission(
  client: MatrixClient,
  roomId: string,
): RoomSendPermission {
  const room = client.getRoom(roomId);
  const me = client.getUserId();

  const membership = room?.getMyMembership();
  if (membership === "ban") return { canSend: false, reason: "banned" };
  if (membership && membership !== "join") return { canSend: false, reason: "left" };

  if (getRoomStateContent<unknown>(room, "m.room.tombstone")) {
    return { canSend: false, reason: "tombstoned" };
  }

  const powerLevels = getRoomStateContent<PowerLevelsContent>(room, "m.room.power_levels");
  const myPowerLevel = Number((me && powerLevels?.users?.[me]) ?? powerLevels?.users_default ?? 0);
  const sendLevel = Number(
    powerLevels?.events?.["m.room.message"] ?? powerLevels?.events_default ?? 0,
  );
  if (myPowerLevel < sendLevel) return { canSend: false, reason: "no-permission" };

  return { canSend: true };
}

export async function inviteUser(
  client: MatrixClient,
  roomId: string,
  userId: string,
): Promise<void> {
  const target = userId.trim();
  if (!target.startsWith("@")) return;
  await client.invite(roomId, target);
}

export async function kickUser(
  client: MatrixClient,
  roomId: string,
  userId: string,
  reason = "Removed from room",
): Promise<void> {
  await client.kick(roomId, userId, reason);
}

export function getRoomMemberPermissions(
  client: MatrixClient,
  roomId: string,
): RoomMemberPermissions {
  const room = client.getRoom(roomId);
  const me = client.getUserId();
  const powerLevels = getRoomStateContent<PowerLevelsContent>(room, "m.room.power_levels");
  const myPowerLevel = Number((me && powerLevels?.users?.[me]) ?? powerLevels?.users_default ?? 0);
  const inviteLevel = Number(powerLevels?.invite ?? powerLevels?.users_default ?? 0);
  const kickLevel = Number(powerLevels?.kick ?? 50);

  return {
    canInvite: myPowerLevel >= inviteLevel,
    canKick: myPowerLevel >= kickLevel,
    myPowerLevel,
  };
}

export function canKickMember(
  client: MatrixClient,
  roomId: string,
  targetUserId: string,
): boolean {
  const permissions = getRoomMemberPermissions(client, roomId);
  if (!permissions.canKick) return false;

  const room = client.getRoom(roomId);
  const me = client.getUserId();
  if (!room || !me || targetUserId === me) return false;

  const powerLevels = getRoomStateContent<PowerLevelsContent>(room, "m.room.power_levels");
  const targetLevel = Number(powerLevels?.users?.[targetUserId] ?? powerLevels?.users_default ?? 0);
  return permissions.myPowerLevel > targetLevel;
}
