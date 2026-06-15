import { useRef } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { getReadUpToEventId, type MatrixMessage } from "@matrix-platform/matrix-core";

/**
 * The id of the first unread message in the active room, frozen for as long as
 * the room stays open. Freezing keeps the "new messages" divider in place while
 * the user reads (Telegram-style) instead of jumping as the read receipt moves.
 * Recomputed only when the room changes.
 *
 * It reads the room's *live timeline* (always current) rather than the memoized
 * `messages` array, which can briefly be a stale preload that still shows the
 * read marker as the last event — that would hide the divider. The `messages`
 * arg only gates resolution until the room has something rendered.
 *
 * Returns null when there's nothing unread (open at the bottom as usual).
 */
export function useFirstUnread(
  client: MatrixClient | null,
  roomId: string | null,
  messages: MatrixMessage[],
): string | null {
  const cache = useRef<{ roomId: string | null; firstUnreadId: string | null; resolved: boolean }>(
    { roomId: null, firstUnreadId: null, resolved: false },
  );

  if (cache.current.roomId !== roomId) {
    cache.current = { roomId, firstUnreadId: null, resolved: false };
  }

  if (!cache.current.resolved && client && roomId && messages.length > 0) {
    const room = client.getRoom(roomId);
    const me = client.getUserId();
    const readUpToId = getReadUpToEventId(client, roomId);

    if (!room || !readUpToId) {
      // No room or no read receipt — nothing to anchor a divider to.
      cache.current.resolved = true;
    } else {
      const events = room.getLiveTimeline().getEvents();
      const readIndex = events.findIndex((event) => event.getId() === readUpToId);
      if (readIndex >= 0) {
        // First message from someone else after the read marker (a divider before
        // our own message would look odd).
        const firstUnread = events.slice(readIndex + 1).find((event) => {
          const id = event.getId();
          return (
            event.getType() === "m.room.message" &&
            !event.isRedacted() &&
            event.getSender() !== me &&
            Boolean(id) &&
            !id!.startsWith("~")
          );
        });
        cache.current.firstUnreadId = firstUnread?.getId() ?? null;
        cache.current.resolved = true;
      }
      // readIndex < 0: the read marker isn't in the loaded window yet — leave it
      // unresolved and retry on the next render once the timeline settles.
    }
  }

  return cache.current.firstUnreadId;
}
