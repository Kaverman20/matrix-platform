import type { MatrixClient } from "matrix-js-sdk";

/**
 * Send a read receipt + read marker up to the latest event in the room, so the
 * server clears the unread count and other devices stay in sync. Safe to call
 * repeatedly — the SDK no-ops when the receipt wouldn't move forward. Returns
 * true if the receipt was sent (or there was nothing to mark), false if the
 * network call failed — so callers can distinguish success from a silent error.
 */
export async function markRoomRead(
  client: MatrixClient,
  roomId: string,
): Promise<boolean> {
  const room = client.getRoom(roomId);
  if (!room) return true;

  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    // Skip local echoes that don't have a real event id yet.
    if (!event.getId() || event.getId()?.startsWith("~")) continue;

    try {
      await client.sendReadReceipt(event);
      await client.setRoomReadMarkers(roomId, event.getId()!);
      return true;
    } catch (error) {
      console.error("[matrix-core] markRoomRead failed", error);
      return false;
    }
  }
  return true;
}

/**
 * The id of the last event the user has read in this room (their persisted read
 * receipt), or null if none. Ignores the synthetic local receipt so callers can
 * tell what was read *before* the room was opened — used to place the "new
 * messages" divider and to open the room at the first unread message.
 */
export function getReadUpToEventId(
  client: MatrixClient,
  roomId: string,
): string | null {
  const room = client.getRoom(roomId);
  const userId = client.getUserId();
  if (!room || !userId) return null;
  return room.getEventReadUpTo(userId, true);
}

/**
 * Send a read receipt + read marker up to a specific event (must be a real,
 * persisted event id). Used by read-on-visible: we only advance the receipt to
 * messages that actually scrolled into view. The SDK no-ops when this wouldn't
 * move the receipt forward, so it's safe to call as the user reads.
 */
export async function markReadUpToEvent(
  client: MatrixClient,
  roomId: string,
  eventId: string,
): Promise<void> {
  const room = client.getRoom(roomId);
  if (!room || !eventId || eventId.startsWith("~")) return;
  const event = room.findEventById(eventId);
  if (!event) return;

  try {
    await client.sendReadReceipt(event);
    await client.setRoomReadMarkers(roomId, eventId);
  } catch (error) {
    console.error("[matrix-core] markReadUpToEvent failed", error);
  }
}
