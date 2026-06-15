import { EventTimeline, type MatrixClient, type Room } from "matrix-js-sdk";

/** Whether there is older history to load above the current live timeline. */
export function canPaginateBackwards(
  client: MatrixClient,
  roomId: string,
): boolean {
  const room = client.getRoom(roomId);
  if (!room) return false;
  return (
    room.getLiveTimeline().getPaginationToken(EventTimeline.BACKWARDS) !== null
  );
}

function countMessages(room: Room): number {
  return room
    .getLiveTimeline()
    .getEvents()
    .filter((event) => event.getType() === "m.room.message" && !event.isRedacted())
    .length;
}

/**
 * Load one older page of history. Returns true when new messages surfaced
 * (caller can keep loading as the user scrolls), false when the page held no
 * new messages — i.e. we've effectively reached the start of the conversation.
 * One page per call keeps it light; the caller paginates lazily on scroll.
 */
export async function paginateBackwards(
  client: MatrixClient,
  roomId: string,
  limit = 50,
): Promise<boolean> {
  const room = client.getRoom(roomId);
  if (!room) return false;

  const timeline = room.getLiveTimeline();
  if (timeline.getPaginationToken(EventTimeline.BACKWARDS) === null) return false;

  const before = countMessages(room);
  try {
    await client.paginateEventTimeline(timeline, { backwards: true, limit });
  } catch (error) {
    console.error("[matrix-core] paginateBackwards failed", error);
    return false;
  }

  return countMessages(room) > before;
}
