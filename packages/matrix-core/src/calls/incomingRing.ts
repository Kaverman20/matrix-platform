import { EventType, RoomEvent, type MatrixClient, type MatrixEvent } from "matrix-js-sdk";
import { parseCallNotificationContent } from "matrix-js-sdk/lib/matrixrtc";

export type IncomingRing = {
  roomId: string;
  callerId: string;
  callerName: string;
  expiresAt: number;
};

/**
 * Subscribes to MatrixRTC `ring` notifications in the given DM rooms.
 * Returns an unsubscribe function.
 */
export function subscribeIncomingRings(
  client: MatrixClient,
  dmRoomIds: readonly string[],
  onRing: (ring: IncomingRing) => void,
): () => void {
  if (dmRoomIds.length === 0) return () => undefined;

  const dmSet = new Set(dmRoomIds);
  const myId = client.getUserId();

  const onTimeline = (event: MatrixEvent, room: { roomId: string } | undefined) => {
    if (!room || !dmSet.has(room.roomId)) return;
    if (event.getType() !== EventType.RTCNotification) return;
    if (event.getSender() === myId) return;

    try {
      const content = parseCallNotificationContent(event.getContent());
      if (content.notification_type !== "ring") return;

      const mentions = content["m.mentions"]?.user_ids;
      if (mentions?.length && myId && !mentions.includes(myId)) return;

      const expiresAt = content.sender_ts + content.lifetime;
      if (Date.now() >= expiresAt) return;

      const sender = event.getSender();
      if (!sender) return;

      const matrixRoom = client.getRoom(room.roomId);
      const member = matrixRoom?.getMember(sender);
      const callerName = member?.rawDisplayName ?? member?.name ?? sender;

      onRing({ roomId: room.roomId, callerId: sender, callerName, expiresAt });
    } catch {
      // Ignore malformed notification events.
    }
  };

  client.on(RoomEvent.Timeline, onTimeline);
  return () => client.off(RoomEvent.Timeline, onTimeline);
}
