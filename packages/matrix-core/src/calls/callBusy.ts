import type { MatrixClient } from "matrix-js-sdk";

/** Returns the other member's user id in a 1:1 room, or null. */
export function getDmPeerUserId(client: MatrixClient, roomId: string): string | null {
  const room = client.getRoom(roomId);
  const myId = client.getUserId();
  if (!room || !myId) return null;

  const peer = room.getJoinedMembers().find((member) => member.userId !== myId);
  return peer?.userId ?? null;
}

/** True when `userId` has a non-expired MatrixRTC membership in any joined room. */
export function userHasActiveRtcMembership(client: MatrixClient, userId: string): boolean {
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== "join") continue;
    const session = client.matrixRTC.getRoomSession(room);
    for (const membership of session.memberships) {
      if (membership.userId === userId && !membership.isExpired()) return true;
    }
  }
  return false;
}
