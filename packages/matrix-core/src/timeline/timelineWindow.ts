import {
  EventTimeline,
  TimelineWindow,
  type Direction,
  type MatrixClient,
  type Room,
} from "matrix-js-sdk";
import { buildTimelineMessagesFromEvents } from "./mapTimeline";
import type { MatrixMessage } from "./messageTypes";

export const DEFAULT_TIMELINE_WINDOW_SIZE = 40;
export const DEFAULT_TIMELINE_WINDOW_LIMIT = 200;

export function createRoomTimelineWindow(
  client: MatrixClient,
  roomId: string,
  options: { windowLimit?: number } = {},
): TimelineWindow | null {
  const room = client.getRoom(roomId);
  if (!room) return null;

  const timelineSet = room.getUnfilteredTimelineSet();
  return new TimelineWindow(client, timelineSet, {
    windowLimit: options.windowLimit ?? DEFAULT_TIMELINE_WINDOW_LIMIT,
  });
}

/** Load a bounded window centred on `eventId` via /context when needed. */
export async function loadTimelineWindowAroundEvent(
  window: TimelineWindow,
  eventId: string,
  size = DEFAULT_TIMELINE_WINDOW_SIZE,
): Promise<void> {
  await window.load(eventId, size);
}

/** Reset the window to the live timeline tail. */
export async function loadTimelineWindowLive(
  window: TimelineWindow,
  size = DEFAULT_TIMELINE_WINDOW_SIZE,
): Promise<void> {
  await window.load(undefined, size);
}

export function getTimelineWindowMessages(
  client: MatrixClient,
  roomId: string,
  window: TimelineWindow,
  focusEventId?: string,
): MatrixMessage[] {
  return buildTimelineMessagesFromEvents(client, roomId, window.getEvents(), {
    includeEventIds: focusEventId ? [focusEventId] : undefined,
  });
}

export function canPaginateTimelineWindow(
  window: TimelineWindow,
  direction: Direction,
): boolean {
  return window.canPaginate(direction);
}

export async function paginateTimelineWindow(
  window: TimelineWindow,
  direction: Direction,
  size = 50,
): Promise<boolean> {
  if (!window.canPaginate(direction)) return false;
  return window.paginate(direction, size, true);
}

export async function paginateTimelineWindowBackwards(
  window: TimelineWindow,
  size = 50,
): Promise<boolean> {
  return paginateTimelineWindow(window, EventTimeline.BACKWARDS, size);
}

export async function paginateTimelineWindowForwards(
  window: TimelineWindow,
  size = 50,
): Promise<boolean> {
  return paginateTimelineWindow(window, EventTimeline.FORWARDS, size);
}

export function canPaginateTimelineWindowBackwards(window: TimelineWindow): boolean {
  return canPaginateTimelineWindow(window, EventTimeline.BACKWARDS);
}

export function canPaginateTimelineWindowForwards(window: TimelineWindow): boolean {
  return canPaginateTimelineWindow(window, EventTimeline.FORWARDS);
}

/** Whether the window end sits on the live timeline tail (no newer events to load). */
export function isTimelineWindowAtLiveEnd(window: TimelineWindow, room: Room): boolean {
  const endIndex = window.getTimelineIndex(EventTimeline.FORWARDS);
  if (!endIndex) return false;

  const liveTimeline = room.getLiveTimeline();
  if (endIndex.timeline !== liveTimeline) return false;

  const absoluteEnd = endIndex.index + liveTimeline.getBaseIndex();
  return absoluteEnd >= liveTimeline.getEvents().length
    && !liveTimeline.getPaginationToken(EventTimeline.FORWARDS);
}
