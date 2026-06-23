import { EventTimeline, type MatrixClient, type Room } from "matrix-js-sdk";
import { buildTimelineMessages } from "./mapTimeline";
import {
  createRoomTimelineWindow,
  getTimelineWindowMessages,
  loadTimelineWindowAroundEvent,
} from "./timelineWindow";
import type { MatrixMessage } from "./messageTypes";

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

/**
 * Находит id строки в UI-списке по event id. Прямое совпадение, либо событие —
 * член схлопнутого альбома (тогда возвращаем id строки альбома). Нужно для jump
 * к закрепу/реплаю: `m.room.pinned_events` хранит id конкретного события, а после
 * `collapseAlbums` id строки = id последнего кадра альбома.
 */
export function resolveUiMessageId(messages: MatrixMessage[], eventId: string): string | null {
  for (const message of messages) {
    if (message.id === eventId) return message.id;
    if (message.albumEventIds?.includes(eventId)) return message.id;
  }
  return null;
}

/** То же, но строит UI-список комнаты сам. */
export function resolveUiMessageIdInRoom(
  client: MatrixClient,
  roomId: string,
  eventId: string,
): string | null {
  return resolveUiMessageId(buildTimelineMessages(client, roomId), eventId);
}

/** Whether the message is present in the rendered UI list (not just the SDK timeline). */
export function isMessageInUiTimeline(
  client: MatrixClient,
  roomId: string,
  messageId: string,
): boolean {
  return resolveUiMessageIdInRoom(client, roomId, messageId) !== null;
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
  if (isMessageInUiTimeline(client, roomId, eventId)) return true;

  const maxPages = options.maxPages ?? 50;
  const pageSize = options.pageSize ?? 50;

  for (let page = 0; page < maxPages; page += 1) {
    if (!canPaginateBackwards(client, roomId)) break;

    const loaded = await paginateBackwards(client, roomId, pageSize);
    if (isMessageInUiTimeline(client, roomId, eventId)) return true;
    if (!loaded) break;
  }

  return isMessageInUiTimeline(client, roomId, eventId);
}

/** Load a bounded slice of history around `eventId` via /context (fallback for jump). */
export async function loadJumpContextMessages(
  client: MatrixClient,
  roomId: string,
  eventId: string,
): Promise<MatrixMessage[] | null> {
  const window = createRoomTimelineWindow(client, roomId);
  if (!window) return null;

  await loadTimelineWindowAroundEvent(window, eventId);
  const hasEvent = window.getEvents().some((event) => event.getId() === eventId);
  if (!hasEvent) return null;

  const messages = getTimelineWindowMessages(client, roomId, window, eventId);
  // Учитываем альбомы: событие может быть схлопнуто в строку альбома.
  return resolveUiMessageId(messages, eventId) ? messages : null;
}
