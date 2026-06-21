import type { MatrixClient } from "matrix-js-sdk";
import { getReadUpToEventId, type MatrixMessage } from "@matrix-platform/matrix-core";

type FirstUnreadCacheEntry = {
  firstUnreadId: string | null;
  resolved: boolean;
};

type ClientCache = {
  firstUnreadByRoom: Map<string, FirstUnreadCacheEntry>;
  // The room currently open for this client. When it changes we drop the room we
  // just left so its "new messages" divider is recomputed fresh on the next visit.
  openRoomId: string | null;
};

// Cache is scoped per client (WeakMap) so the divider state can't leak across
// account switches, and an old client's cache is GC'd with it. Keyed by client
// rather than held in a ref so the value can be memoized during render without
// violating the rules of hooks.
const cacheByClient = new WeakMap<MatrixClient, ClientCache>();

function cacheForClient(client: MatrixClient): ClientCache {
  let cache = cacheByClient.get(client);
  if (!cache) {
    cache = { firstUnreadByRoom: new Map(), openRoomId: null };
    cacheByClient.set(client, cache);
  }
  return cache;
}

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
  if (!client) return null;

  const cache = cacheForClient(client);
  const { firstUnreadByRoom } = cache;

  if (roomId !== cache.openRoomId) {
    if (cache.openRoomId) firstUnreadByRoom.delete(cache.openRoomId);
    cache.openRoomId = roomId;
  }

  if (!roomId) return null;

  const cached = firstUnreadByRoom.get(roomId);
  if (cached?.resolved) return cached.firstUnreadId;
  if (messages.length === 0) return cached?.firstUnreadId ?? null;

  const room = client.getRoom(roomId);
  const me = client.getUserId();
  const readUpToId = getReadUpToEventId(client, roomId);

  if (!room || !readUpToId) {
    // No room or no read receipt — nothing to anchor a divider to.
    firstUnreadByRoom.set(roomId, { firstUnreadId: null, resolved: true });
    return null;
  }

  const events = room.getLiveTimeline().getEvents();
  const readIndex = events.findIndex((event) => event.getId() === readUpToId);
  if (readIndex < 0) {
    // The read marker isn't in the loaded window yet — leave it unresolved and
    // retry on the next render once the timeline settles.
    return cached?.firstUnreadId ?? null;
  }

  // First message from someone else after the read marker (a divider before our
  // own message would look odd).
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

  const firstUnreadId = firstUnread?.getId() ?? null;
  firstUnreadByRoom.set(roomId, { firstUnreadId, resolved: true });
  return firstUnreadId;
}
