import { EventType, RelationType, RoomEvent, type MatrixClient, type MatrixEvent } from "matrix-js-sdk";

/** Sends MSC4310 `rtc.decline` so the caller's other devices stop ringing. */
export async function declineIncomingCall(
  client: MatrixClient,
  roomId: string,
  notificationEventId: string,
): Promise<void> {
  await client.sendEvent(roomId, EventType.RTCDecline, {
    "m.relates_to": {
      event_id: notificationEventId,
      rel_type: RelationType.Reference,
    },
  });
}

/**
 * Fires when another user declines an incoming ring in `roomId` (outgoing caller
 * should stop dialling and show «Абонент сбросил»).
 */
export function subscribePeerDeclined(
  client: MatrixClient,
  roomId: string,
  onDeclined: (declinerId: string) => void,
): () => void {
  const myId = client.getUserId();

  const onTimeline = (event: MatrixEvent, room?: { roomId: string }) => {
    if (room?.roomId !== roomId) return;
    if (event.getType() !== EventType.RTCDecline) return;

    const relation = event.getContent()?.["m.relates_to"] as
      | { rel_type?: string; event_id?: string }
      | undefined;
    if (relation?.rel_type !== RelationType.Reference || !relation.event_id) return;

    const sender = event.getSender();
    if (!sender || sender === myId) return;
    onDeclined(sender);
  };

  client.on(RoomEvent.Timeline, onTimeline);
  return () => client.off(RoomEvent.Timeline, onTimeline);
}
