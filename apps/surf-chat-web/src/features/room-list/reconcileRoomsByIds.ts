import type { MatrixRoomSummary } from "@matrix-platform/matrix-core";

/**
 * Reorder `next` to follow the order in `previousIds` (a persisted manual
 * order), appending any rooms not present in that list at the end and dropping
 * ids that no longer exist.
 */
export function reconcileRoomsByIds(
  next: MatrixRoomSummary[],
  previousIds: string[],
): MatrixRoomSummary[] {
  const nextById = new Map(next.map((room) => [room.id, room]));
  const kept = previousIds
    .map((id) => nextById.get(id))
    .filter((room): room is MatrixRoomSummary => Boolean(room));
  const keptIds = new Set(kept.map((room) => room.id));
  const added = next.filter((room) => !keptIds.has(room.id));
  return [...kept, ...added];
}
