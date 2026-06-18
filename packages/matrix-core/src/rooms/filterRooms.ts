import type { MatrixRoomSummary } from "./roomTypes";

/** Normalizes sidebar search input for case-insensitive matching. */
export function normalizeRoomSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Returns true when a room matches the normalized sidebar search query. */
export function roomSummaryMatchesQuery(room: MatrixRoomSummary, query: string): boolean {
  if (!query) return true;

  const fields = [
    room.name,
    room.preview,
    room.topic,
    room.id,
    room.directUserId ?? "",
  ];

  const haystack = fields.join(" ").toLowerCase();
  if (haystack.includes(query)) return true;

  if (query.startsWith("@")) {
    return haystack.includes(query.slice(1));
  }

  return false;
}

/** Filters room summaries for the sidebar search box. */
export function filterRoomSummaries(
  rooms: MatrixRoomSummary[],
  query: string,
): MatrixRoomSummary[] {
  const normalized = normalizeRoomSearchQuery(query);
  if (!normalized) return rooms;
  return rooms.filter((room) => roomSummaryMatchesQuery(room, normalized));
}
