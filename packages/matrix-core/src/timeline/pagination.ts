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

/**
 * Whether the event is present in the *live* timeline — the same event set
 * that `buildTimelineMessages` renders. We deliberately do NOT use
 * `room.findEventById`, which also matches events sitting in other timeline
 * sets (search contexts, threads). The global search loads matched events into
 * a separate context timeline, so `findEventById` would report the event as
 * present before it has actually been paginated into the live timeline the UI
 * shows — making jump-to-message give up before the message is rendered.
 */
export function isEventInTimeline(
  client: MatrixClient,
  roomId: string,
  eventId: string,
): boolean {
  const room = client.getRoom(roomId);
  if (!room) return false;
  return room
    .getLiveTimeline()
    .getEvents()
    .some((event) => event.getId() === eventId);
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

/**
 * Paginate backwards until `eventId` appears in the room timeline, or history
 * is exhausted. Used for jump-to-reply, pinned messages, and deep links.
 */
export async function paginateToEvent(
  client: MatrixClient,
  roomId: string,
  eventId: string,
  options: { maxPages?: number; pageSize?: number } = {},
): Promise<boolean> {
  if (isEventInTimeline(client, roomId, eventId)) return true;

  const maxPages = options.maxPages ?? 50;
  const pageSize = options.pageSize ?? 50;

  for (let page = 0; page < maxPages; page += 1) {
    if (!canPaginateBackwards(client, roomId)) return false;

    const loaded = await paginateBackwards(client, roomId, pageSize);
    if (isEventInTimeline(client, roomId, eventId)) return true;
    if (!loaded) return false;
  }

  return isEventInTimeline(client, roomId, eventId);
}
