import type { MatrixClient } from "matrix-js-sdk";
import type { CallMembership } from "matrix-js-sdk/lib/matrixrtc/CallMembership";

/** Returns the other member's user id in a 1:1 room, or null. */
export function getDmPeerUserId(client: MatrixClient, roomId: string): string | null {
  const room = client.getRoom(roomId);
  const myId = client.getUserId();
  if (!room || !myId) return null;

  const peer = room.getJoinedMembers().find((member) => member.userId !== myId);
  return peer?.userId ?? null;
}

function activeMembers(memberships: CallMembership[]): CallMembership[] {
  return memberships.filter((m) => !m.isExpired());
}

/**
 * True when `userId` is in an active multi-party RTC session (2+ members).
 * Solo stale memberships after a failed/hung call do NOT count as busy.
 */
export function userIsInActiveCall(client: MatrixClient, userId: string): boolean {
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== "join") continue;
    const session = client.matrixRTC.getRoomSession(room);
    const active = activeMembers(session.memberships);
    if (active.length < 2) continue;
    if (active.some((m) => m.userId === userId)) return true;
  }
  return false;
}

/** @deprecated Use {@link userIsInActiveCall}. Solo memberships caused false «Занят». */
export function userHasActiveRtcMembership(client: MatrixClient, userId: string): boolean {
  return userIsInActiveCall(client, userId);
}
