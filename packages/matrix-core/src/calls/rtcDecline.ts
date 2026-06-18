import { EventType, RelationType, RoomEvent, type MatrixClient, type MatrixEvent } from "matrix-js-sdk";

/** Custom decline reason — not in MSC4310 yet; Surf Chat clients read this. */
export const RTC_DECLINE_REASON_KEY = "run.foxhound.decline_reason";

export type DeclineReason = "declined" | "busy";

export type PeerDeclinedInfo = {
  declinerId: string;
  reason: DeclineReason;
};

/** Sends MSC4310 `rtc.decline` so the caller's other devices stop ringing. */
export async function declineIncomingCall(
  client: MatrixClient,
  roomId: string,
  notificationEventId: string,
  reason: DeclineReason = "declined",
): Promise<void> {
  const content: Record<string, unknown> = {
    "m.relates_to": {
      event_id: notificationEventId,
      rel_type: RelationType.Reference,
    },
  };
  if (reason === "busy") {
    content[RTC_DECLINE_REASON_KEY] = "busy";
  }
  await client.sendEvent(roomId, EventType.RTCDecline, content as never);
}

function parseDeclineReason(content: Record<string, unknown>): DeclineReason {
  return content[RTC_DECLINE_REASON_KEY] === "busy" ? "busy" : "declined";
}

/**
 * Fires when another user declines an incoming ring in `roomId` (outgoing caller
 * should stop dialling and show «Абонент сбросил» or «Занят»).
 */
export function subscribePeerDeclined(
  client: MatrixClient,
  roomId: string,
  onDeclined: (info: PeerDeclinedInfo) => void,
): () => void {
  const myId = client.getUserId();

  const onTimeline = (event: MatrixEvent, room?: { roomId: string }) => {
    if (room?.roomId !== roomId) return;
    if (event.getType() !== EventType.RTCDecline) return;

    const content = event.getContent();
    const relation = content?.["m.relates_to"] as
      | { rel_type?: string; event_id?: string }
      | undefined;
    if (relation?.rel_type !== RelationType.Reference || !relation.event_id) return;

    const sender = event.getSender();
    if (!sender || sender === myId) return;
    onDeclined({ declinerId: sender, reason: parseDeclineReason(content) });
  };

  client.on(RoomEvent.Timeline, onTimeline);
  return () => client.off(RoomEvent.Timeline, onTimeline);
}
