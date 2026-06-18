import type { MatrixSpaceSummary } from "./roomTypes";

/**
 * Finds the deepest joined space that directly lists the room as m.space.child.
 * Returns null when the room is not in any space (typical for DMs).
 */
export function findSpaceIdForRoom(
  spaces: readonly MatrixSpaceSummary[],
  roomId: string,
): string | null {
  const candidates = spaces.filter((space) => space.childIds.includes(roomId));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!.id;

  const parentOf = new Map<string, string>();
  for (const space of spaces) {
    for (const childSpaceId of space.childSpaceIds) {
      parentOf.set(childSpaceId, space.id);
    }
  }

  const depth = (spaceId: string): number => {
    let level = 0;
    let current: string | undefined = spaceId;
    const seen = new Set<string>();
    while (current && parentOf.has(current) && !seen.has(current)) {
      seen.add(current);
      level += 1;
      current = parentOf.get(current);
    }
    return level;
  };

  return candidates.reduce((deepest, space) =>
    depth(space.id) > depth(deepest.id) ? space : deepest,
  ).id;
}
