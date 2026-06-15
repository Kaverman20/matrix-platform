import type { MatrixClient } from "matrix-js-sdk";

/**
 * Send a read receipt + read marker up to the latest event in the room, so the
 * server clears the unread count and other devices stay in sync. Safe to call
 * repeatedly — the SDK no-ops when the receipt wouldn't move forward.
 */
export async function markRoomRead(
  client: MatrixClient,
  roomId: string,
): Promise<void> {
  const room = client.getRoom(roomId);
  if (!room) return;

  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    // Skip local echoes that don't have a real event id yet.
    if (!event.getId() || event.getId()?.startsWith("~")) continue;

    try {
      await client.sendReadReceipt(event);
      await client.setRoomReadMarkers(roomId, event.getId()!);
    } catch (error) {
      console.error("[matrix-core] markRoomRead failed", error);
    }
    return;
  }
}
