import { RoomMemberEvent, type MatrixClient } from "matrix-js-sdk";

const TYPING_TIMEOUT_MS = 4000;

/**
 * Calls onChange whenever any member's typing state changes. The event is
 * client-level (room-agnostic); pair with getTypingNames to read the current
 * typists for a specific room. Returns an unsubscribe.
 */
export function subscribeTyping(
  client: MatrixClient,
  onChange: () => void,
): () => void {
  client.on(RoomMemberEvent.Typing, onChange);
  return () => {
    client.off(RoomMemberEvent.Typing, onChange);
  };
}

/** Tell the server whether the local user is currently typing in a room. */
export function setTyping(
  client: MatrixClient,
  roomId: string,
  isTyping: boolean,
): Promise<unknown> {
  return client
    .sendTyping(roomId, isTyping, isTyping ? TYPING_TIMEOUT_MS : 0)
    .catch((error) => {
      console.error("[matrix-core] setTyping failed", error);
    });
}

/** Display names of other members currently typing in the room. */
export function getTypingNames(
  client: MatrixClient,
  roomId: string,
): string[] {
  const room = client.getRoom(roomId);
  if (!room) return [];
  const me = client.getUserId();

  return room
    .getMembers()
    .filter((member) => member.typing && member.userId !== me)
    .map((member) => member.name || member.userId);
}
