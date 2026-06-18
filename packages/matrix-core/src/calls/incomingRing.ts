import { EventType, RelationType, RoomEvent, type MatrixClient, type MatrixEvent } from "matrix-js-sdk";
import { MatrixRTCSessionEvent } from "matrix-js-sdk/lib/matrixrtc/MatrixRTCSession";
import type { CallMembership } from "matrix-js-sdk/lib/matrixrtc/CallMembership";
import { parseCallNotificationContent } from "matrix-js-sdk/lib/matrixrtc";

import type { CallIntent } from "./rtcSession";

export type IncomingRing = {
  roomId: string;
  callerId: string;
  callerName: string;
  /** Matrix event id of the ring notification — required to send rtc.decline. */
  notificationEventId: string;
  /** audio | video — so the callee shows the right label and answers in kind. */
  callIntent: CallIntent;
  expiresAt: number;
};

export type IncomingRingEnded = {
  roomId: string;
  /** Omitted when any incoming ring in the room should clear (e.g. rtc.decline). */
  callerId?: string;
};

export type IncomingCallSignalHandlers = {
  onRing: (ring: IncomingRing) => void;
  /** Caller hung up, declined, or left the RTC session before answer. */
  onRingEnded: (ended: IncomingRingEnded) => void;
};

function activeCallerIds(memberships: CallMembership[]): Set<string> {
  const ids = new Set<string>();
  for (const membership of memberships) {
    if (!membership.isExpired()) ids.add(membership.userId);
  }
  return ids;
}

function callersWhoLeft(
  roomId: string,
  previous: CallMembership[],
  next: CallMembership[],
  myId: string | null,
): IncomingRingEnded[] {
  const stillActive = activeCallerIds(next);
  const ended: IncomingRingEnded[] = [];
  const seen = new Set<string>();

  for (const membership of previous) {
    const callerId = membership.userId;
    if (callerId === myId || stillActive.has(callerId) || seen.has(callerId)) continue;
    seen.add(callerId);
    ended.push({ roomId, callerId });
  }

  return ended;
}

function tryParseRing(
  client: MatrixClient,
  event: MatrixEvent,
  roomId: string,
  myId: string | null,
): IncomingRing | null {
  if (event.getType() !== EventType.RTCNotification) return null;
  if (event.getSender() === myId) return null;

  try {
    const content = parseCallNotificationContent(event.getContent());
    if (content.notification_type !== "ring") return null;

    const mentions = content["m.mentions"]?.user_ids;
    if (mentions?.length && myId && !mentions.includes(myId)) return null;

    const expiresAt = content.sender_ts + content.lifetime;
    if (Date.now() >= expiresAt) return null;

    const sender = event.getSender();
    if (!sender) return null;

    const notificationEventId = event.getId();
    if (!notificationEventId) return null;

    const matrixRoom = client.getRoom(roomId);
    const member = matrixRoom?.getMember(sender);
    const callerName = member?.rawDisplayName ?? member?.name ?? sender;

    let callIntent: CallIntent = "audio";
    if (matrixRoom) {
      const session = client.matrixRTC.getRoomSession(matrixRoom);
      const callerMembership = session.memberships.find((m) => m.userId === sender);
      if (callerMembership?.callIntent === "video") callIntent = "video";
    }

    return {
      roomId,
      callerId: sender,
      callerName,
      notificationEventId,
      callIntent,
      expiresAt,
    };
  } catch {
    return null;
  }
}

/** Catch rings that arrived before the listener was attached. */
function scanRecentRings(
  client: MatrixClient,
  roomIds: readonly string[],
  myId: string | null,
  onRing: (ring: IncomingRing) => void,
): void {
  for (const roomId of roomIds) {
    const room = client.getRoom(roomId);
    if (!room?.getLiveTimeline) continue;
    const events = room.getLiveTimeline().getEvents();
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i];
      const ring = tryParseRing(client, event, roomId, myId);
      if (ring) {
        onRing(ring);
        break;
      }
    }
  }
}

/**
 * Subscribes to MatrixRTC incoming-call signals in DM rooms: ring notifications,
 * caller leaving the session (cancel before answer), and explicit declines.
 */
export function subscribeIncomingCallSignals(
  client: MatrixClient,
  dmRoomIds: readonly string[],
  handlers: IncomingCallSignalHandlers,
): () => void {
  if (dmRoomIds.length === 0) return () => undefined;

  const dmSet = new Set(dmRoomIds);
  const myId = client.getUserId();
  const cleanups: Array<() => void> = [];

  const onTimeline = (event: MatrixEvent, room: { roomId: string } | undefined) => {
    if (!room || !dmSet.has(room.roomId)) return;

    const ring = tryParseRing(client, event, room.roomId, myId);
    if (ring) {
      handlers.onRing(ring);
      return;
    }

    if (event.getType() === EventType.RTCDecline && event.getSender() !== myId) {
      const relation = event.getContent()?.["m.relates_to"] as
        | { rel_type?: string; event_id?: string }
        | undefined;
      if (relation?.rel_type !== RelationType.Reference || !relation.event_id) return;

      const sender = event.getSender();
      if (!sender || sender === myId) return;
      handlers.onRingEnded({ roomId: room.roomId });
    }
  };

  client.on(RoomEvent.Timeline, onTimeline);
  cleanups.push(() => client.off(RoomEvent.Timeline, onTimeline));

  for (const roomId of dmRoomIds) {
    const room = client.getRoom(roomId);
    if (!room) continue;

    const session = client.matrixRTC.getRoomSession(room);

    const onMembershipsChanged = (oldMemberships: CallMembership[], newMemberships: CallMembership[]) => {
      const ended = callersWhoLeft(roomId, oldMemberships, newMemberships, myId);
      for (const item of ended) handlers.onRingEnded(item);
    };

    session.on(MatrixRTCSessionEvent.MembershipsChanged, onMembershipsChanged);
    cleanups.push(() => {
      session.off(MatrixRTCSessionEvent.MembershipsChanged, onMembershipsChanged);
    });
  }

  scanRecentRings(client, dmRoomIds, myId, handlers.onRing);

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

/** @deprecated Use {@link subscribeIncomingCallSignals}. */
export function subscribeIncomingRings(
  client: MatrixClient,
  dmRoomIds: readonly string[],
  onRing: (ring: IncomingRing) => void,
): () => void {
  return subscribeIncomingCallSignals(client, dmRoomIds, { onRing, onRingEnded: () => undefined });
}
