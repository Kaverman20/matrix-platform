import type { MatrixClient, Room } from "matrix-js-sdk";

type DirectAccountData = Record<string, string[]>;

function getDmRoomIds(client: MatrixClient): Set<string> {
  const ev = client.getAccountData("m.direct" as never);
  const content = (ev?.getContent() ?? {}) as DirectAccountData;
  const ids = new Set<string>();

  for (const roomIds of Object.values(content)) {
    if (Array.isArray(roomIds)) {
      for (const roomId of roomIds) ids.add(roomId);
    }
  }

  return ids;
}

/** Whether this joined room should receive incoming-call signals (1:1 DM). */
export function isIncomingCallRoom(room: Room, dmIds: Set<string>): boolean {
  if (room.isSpaceRoom()) return false;
  if (room.getMyMembership() !== "join") return false;

  if (dmIds.has(room.roomId)) return true;

  const memberCount = room.getInvitedAndJoinedMemberCount();
  if (memberCount !== 2) return false;

  const nameEvent = room.currentState.getStateEvents("m.room.name", "");
  const hasName = Boolean(nameEvent?.getContent().name);
  const hasAlias = Boolean(room.getCanonicalAlias());

  return !hasName && !hasAlias;
}

/**
 * All joined 1:1 rooms that should listen for incoming rings — favourites,
 * duplicate DMs, and m.direct entries included (NOT the deduped sidebar list).
 */
export function listIncomingCallRoomIds(client: MatrixClient): string[] {
  const dmIds = getDmRoomIds(client);
  return client
    .getRooms()
    .filter((room) => isIncomingCallRoom(room, dmIds))
    .map((room) => room.roomId);
}
