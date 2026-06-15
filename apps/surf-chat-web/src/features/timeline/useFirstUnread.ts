import { useRef } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { getReadUpToEventId, type MatrixMessage } from "@matrix-platform/matrix-core";

/**
 * The id of the first unread message in the active room, frozen for as long as
 * the room stays open. Freezing keeps the "new messages" divider in place while
 * the user reads (Telegram-style) instead of jumping as the read receipt moves.
 * Recomputed only when the room changes.
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

  // Resolve once, as soon as messages for this room are available.
  if (!cache.current.resolved && client && roomId && messages.length > 0) {
    const readUpToId = getReadUpToEventId(client, roomId);
    if (readUpToId) {
      const readIndex = messages.findIndex((message) => message.id === readUpToId);
      if (readIndex >= 0 && readIndex < messages.length - 1) {
        // First unread message from someone else after the read marker. (A
        // divider before our own message would look odd.)
        const next = messages.slice(readIndex + 1).find((message) => !message.own);
        cache.current.firstUnreadId = next ? next.id : null;
      }
    }
    cache.current.resolved = true;
  }

  return cache.current.firstUnreadId;
}
