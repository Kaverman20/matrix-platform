import { EventTimeline, type MatrixClient, type Room } from "matrix-js-sdk";

const PINNED_EVENTS_TYPE = "m.room.pinned_events";

type PowerLevelsContent = {
  users?: Record<string, number>;
  users_default?: number;
  events?: Record<string, number>;
  state_default?: number;
};

export function canPinMessages(client: MatrixClient | null, roomId: string | null): boolean {
  if (!client || !roomId) return false;

  const room = client.getRoom(roomId);
  if (!room) return false;

  const powerLevels = getRoomStateContent<PowerLevelsContent>(room, "m.room.power_levels");
  const me = client.getUserId();
  const myLevel = Number((me && powerLevels?.users?.[me]) ?? powerLevels?.users_default ?? 0);
  const requiredLevel = Number(powerLevels?.events?.[PINNED_EVENTS_TYPE] ?? powerLevels?.state_default ?? 50);

  return myLevel >= requiredLevel;
}

export function getPinnedEventIds(
  client: MatrixClient | null,
  roomId: string | null,
  overrideIds?: string[] | null,
): string[] {
  if (overrideIds) return overrideIds;
  if (!client || !roomId) return [];

  const room = client.getRoom(roomId);
  if (!room) return [];

  const content = getRoomStateContent<{ pinned?: unknown }>(room, PINNED_EVENTS_TYPE);
  return Array.isArray(content?.pinned)
    ? content.pinned.filter((id): id is string => typeof id === "string")
    : [];
}

export function togglePinnedEventId(currentIds: string[], eventId: string): string[] {
  return currentIds.includes(eventId)
    ? currentIds.filter((id) => id !== eventId)
    : [...currentIds, eventId];
}

export async function setPinnedEventIds(
  client: MatrixClient,
  roomId: string,
  pinnedIds: string[],
): Promise<void> {
  await client.sendStateEvent(roomId, PINNED_EVENTS_TYPE as never, { pinned: pinnedIds } as never, "");
}

function getRoomStateContent<T>(room: Room, eventType: string): T | undefined {
  return (
    room.currentState.getStateEvents(eventType, "")?.getContent()
    ?? room.getLiveTimeline().getState(EventTimeline.FORWARDS)?.getStateEvents(eventType, "")?.getContent()
  ) as T | undefined;
}
