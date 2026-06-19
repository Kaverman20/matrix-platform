import type { MatrixClient } from "matrix-js-sdk";

export type RoomMessageSearchHit = {
  eventId: string;
  roomId: string;
  body: string;
  timestamp: number;
};

/** Server-side search for message text inside a single room. */
export async function searchRoomMessages(
  client: MatrixClient,
  roomId: string,
  term: string,
  limit = 30,
): Promise<RoomMessageSearchHit[]> {
  const query = term.trim();
  if (!query) return [];

  const results = await client.searchRoomEvents({
    term: query,
    filter: { rooms: [roomId] },
  });

  return results.results
    .map((searchResult): RoomMessageSearchHit | null => {
      const event = searchResult.context.getEvent();
      const eventId = event.getId();
      if (!eventId) return null;
      const content = event.getContent() as { body?: unknown };
      const body = typeof content.body === "string" ? content.body : "";
      return {
        eventId,
        roomId: event.getRoomId() ?? roomId,
        body,
        timestamp: event.getTs(),
      };
    })
    .filter((hit): hit is RoomMessageSearchHit => Boolean(hit))
    .slice(0, limit);
}

/** Case-insensitive filter over already-loaded timeline messages. */
export function filterLoadedMessages<T extends { id: string; text: string; kind?: string }>(
  messages: T[],
  term: string,
): T[] {
  const query = term.trim().toLowerCase();
  if (!query) return [];

  return messages.filter(
    (message) => message.kind !== "system" && message.text.toLowerCase().includes(query),
  );
}
