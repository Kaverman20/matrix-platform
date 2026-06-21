import type { MatrixClient } from "matrix-js-sdk";
import { filterRoomSummaries } from "../rooms/filterRooms";
import type { MatrixRoomSummary } from "../rooms/roomTypes";
import { resolveSidebarUserSearch } from "../rooms/sidebarUserSearch";
import type { UserDirectoryEntry } from "../rooms/createRoom";
import { searchUserDirectory } from "../rooms/createRoom";

export type GlobalMessageSearchHit = {
  eventId: string;
  roomId: string;
  body: string;
  timestamp: number;
  senderId?: string;
};

export type GlobalSearchRoomItem = {
  kind: "room";
  room: MatrixRoomSummary;
};

export type GlobalSearchUserItem = {
  kind: "user";
  user: UserDirectoryEntry;
};

export type GlobalSearchMessageItem = {
  kind: "message";
  hit: GlobalMessageSearchHit;
  roomName: string;
};

export type GlobalSearchItem =
  | GlobalSearchRoomItem
  | GlobalSearchUserItem
  | GlobalSearchMessageItem;

/** Server-side message search across all joined rooms. */
export async function searchGlobalMessages(
  client: MatrixClient,
  term: string,
  limit = 20,
): Promise<GlobalMessageSearchHit[]> {
  const query = term.trim();
  if (!query) return [];

  const results = await client.searchRoomEvents({ term: query });

  return results.results
    .map((searchResult): GlobalMessageSearchHit | null => {
      const event = searchResult.context.getEvent();
      const eventId = event.getId();
      if (!eventId) return null;
      const content = event.getContent() as { body?: unknown };
      const body = typeof content.body === "string" ? content.body : "";
      const roomId = event.getRoomId();
      if (!roomId) return null;
      return {
        eventId,
        roomId,
        body,
        timestamp: event.getTs(),
        senderId: event.getSender() ?? undefined,
      };
    })
    .filter((hit): hit is GlobalMessageSearchHit => Boolean(hit))
    .slice(0, limit);
}

type BuildGlobalSearchItemsOptions = {
  query: string;
  rooms: MatrixRoomSummary[];
  users: UserDirectoryEntry[];
  messages: GlobalMessageSearchHit[];
  roomNameById: Map<string, string>;
  roomLimit?: number;
  userLimit?: number;
  messageLimit?: number;
};

/** Builds a flat, keyboard-navigable list for the global search modal. */
export function buildGlobalSearchItems({
  query,
  rooms,
  users,
  messages,
  roomNameById,
  roomLimit = 6,
  userLimit = 6,
  messageLimit = 12,
}: BuildGlobalSearchItemsOptions): GlobalSearchItem[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const items: GlobalSearchItem[] = [];

  for (const room of filterRoomSummaries(rooms, trimmed).slice(0, roomLimit)) {
    items.push({ kind: "room", room });
  }
  for (const user of users.slice(0, userLimit)) {
    items.push({ kind: "user", user });
  }
  for (const hit of messages.slice(0, messageLimit)) {
    items.push({
      kind: "message",
      hit,
      roomName: roomNameById.get(hit.roomId) ?? hit.roomId,
    });
  }

  return items;
}

/** Loads user directory hits for global search (debounced by caller). */
export async function searchGlobalUsers(
  client: MatrixClient,
  query: string,
  existingDmUserIds: Set<string>,
  limit = 8,
): Promise<UserDirectoryEntry[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const directoryResults = await searchUserDirectory(client, term, limit);
  return resolveSidebarUserSearch(term, directoryResults, existingDmUserIds);
}
