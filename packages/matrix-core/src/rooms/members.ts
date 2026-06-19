import { EventTimeline, type MatrixClient, type Room } from "matrix-js-sdk";

type PowerLevelsContent = {
  users?: Record<string, number>;
  users_default?: number;
  invite?: number;
  kick?: number;
  ban?: number;
};

export type RoomMemberPermissions = {
  canInvite: boolean;
  canKick: boolean;
  myPowerLevel: number;
};

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

function getRoomStateContent<T>(room: Room | null | undefined, eventType: string): T | undefined {
  if (!room) return undefined;
  return (
    room.currentState.getStateEvents(eventType, "")?.getContent()
    ?? room.getLiveTimeline().getState(EventTimeline.FORWARDS)?.getStateEvents(eventType, "")?.getContent()
  ) as T | undefined;
}
