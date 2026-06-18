import { findSpaceIdForRoom } from "./findSpaceForRoom";
import type { MatrixRoomGroups, MatrixRoomSummary, MatrixSpaceSummary } from "./roomTypes";

function collectAllRooms(
  roomGroups: Pick<MatrixRoomGroups, "favourites" | "channels" | "dms">,
): MatrixRoomSummary[] {
  const byId = new Map<string, MatrixRoomSummary>();
  for (const room of [...roomGroups.favourites, ...roomGroups.channels, ...roomGroups.dms]) {
    byId.set(room.id, room);
  }
  return [...byId.values()];
}

function findTopLevelSpaceId(
  spaces: readonly MatrixSpaceSummary[],
  spaceId: string,
): string | null {
  const topLevelIds = new Set(spaces.filter((space) => !space.nested).map((space) => space.id));
  if (topLevelIds.has(spaceId)) return spaceId;

  const parentOf = new Map<string, string>();
  for (const space of spaces) {
    for (const childSpaceId of space.childSpaceIds) {
      parentOf.set(childSpaceId, space.id);
    }
  }

  let current: string | null = spaceId;
  const seen = new Set<string>();
  while (current && parentOf.has(current) && !seen.has(current)) {
    seen.add(current);
    current = parentOf.get(current) ?? null;
  }

  return current && topLevelIds.has(current) ? current : null;
}

function aggregateTopLevelSpaceCounts(
  spaces: readonly MatrixSpaceSummary[],
  roomGroups: Pick<MatrixRoomGroups, "favourites" | "channels" | "dms">,
  pickCount: (room: MatrixRoomSummary) => number,
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};

  for (const room of collectAllRooms(roomGroups)) {
    const amount = pickCount(room);
    if (amount <= 0) continue;

    const spaceId = findSpaceIdForRoom(spaces, room.id);
    if (!spaceId) continue;

    const topLevelId = findTopLevelSpaceId(spaces, spaceId);
    if (!topLevelId) continue;

    counts[topLevelId] = (counts[topLevelId] ?? 0) + amount;
  }

  return counts;
}

function sumRoomCounts(
  roomGroups: Pick<MatrixRoomGroups, "favourites" | "channels" | "dms">,
  pickCount: (room: MatrixRoomSummary) => number,
  filter?: (room: MatrixRoomSummary) => boolean,
): number {
  let total = 0;
  for (const room of collectAllRooms(roomGroups)) {
    if (filter && !filter(room)) continue;
    total += pickCount(room);
  }
  return total;
}

/** Sums room unreads onto their top-level space rail ancestor. */
export function computeTopLevelSpaceUnreads(
  spaces: readonly MatrixSpaceSummary[],
  roomGroups: Pick<MatrixRoomGroups, "favourites" | "channels" | "dms">,
): Readonly<Record<string, number>> {
  return aggregateTopLevelSpaceCounts(spaces, roomGroups, (room) => room.unread);
}

/** Sums mention/highlight unreads onto their top-level space rail ancestor. */
export function computeTopLevelSpaceMentions(
  spaces: readonly MatrixSpaceSummary[],
  roomGroups: Pick<MatrixRoomGroups, "favourites" | "channels" | "dms">,
): Readonly<Record<string, number>> {
  return aggregateTopLevelSpaceCounts(spaces, roomGroups, (room) => room.mentions);
}

/** Sums unread counts across all direct-message rooms. */
export function computeDmUnreads(
  roomGroups: Pick<MatrixRoomGroups, "favourites" | "channels" | "dms">,
): number {
  return sumRoomCounts(roomGroups, (room) => room.unread, (room) => room.kind === "dm");
}

/** Sums mention/highlight counts across all direct-message rooms. */
export function computeDmMentions(
  roomGroups: Pick<MatrixRoomGroups, "favourites" | "channels" | "dms">,
): number {
  return sumRoomCounts(roomGroups, (room) => room.mentions, (room) => room.kind === "dm");
}

/** Compact badge label for sidebar / rail unread counts. */
export function formatUnreadCount(count: number): string {
  if (count <= 0) return "";
  return count > 99 ? "99+" : String(count);
}
