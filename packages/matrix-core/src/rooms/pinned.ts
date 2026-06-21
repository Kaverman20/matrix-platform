import { RoomStateEvent, type MatrixClient, type MatrixEvent } from "matrix-js-sdk";
import { getRoomStateContent } from "../util/roomState";
import type { MatrixMessageReference } from "../timeline/messageTypes";
import { colorForId } from "./colors";

const PINNED_EVENTS_TYPE = "m.room.pinned_events";

type PowerLevelsContent = {
  users?: Record<string, number>;
  users_default?: number;
  events?: Record<string, number>;
  state_default?: number;
};

export type MatrixPinnedMessage = MatrixMessageReference & {
  color?: string;
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

export function mapPinnedMessages(
  client: MatrixClient | null,
  roomId: string | null,
  pinnedIds: string[],
): MatrixPinnedMessage[] {
  if (!client || !roomId) return [];

  const room = client.getRoom(roomId);
  if (!room) return [];

  return pinnedIds
    .map<MatrixPinnedMessage | null>((id) => {
      const event = room.findEventById(id);
      if (!event) {
        return { id, text: "Сообщение не загружено" };
      }

      if (event.isRedacted() || event.getType() !== "m.room.message") {
        return null;
      }

      const sender = event.getSender() ?? undefined;
      const member = sender ? room.getMember(sender) : null;
      const color = sender ? colorForId(sender) : undefined;
      const body = event.replacingEvent()?.getContent()?.["m.new_content"] as
        | { body?: unknown }
        | undefined;
      const text = typeof body?.body === "string"
        ? body.body
        : typeof event.getContent().body === "string"
          ? event.getContent().body as string
          : "Сообщение";

      return {
        id,
        sender,
        author: member?.name || sender,
        text,
        color,
      };
    })
    .filter((message): message is MatrixPinnedMessage => message !== null);
}

export function subscribePinnedEvents(
  client: MatrixClient,
  roomId: string,
  onChange: () => void,
): () => void {
  const onState = (event: MatrixEvent) => {
    if (event.getType() !== PINNED_EVENTS_TYPE) return;
    if (event.getRoomId() !== roomId) return;
    onChange();
  };

  client.on(RoomStateEvent.Events, onState);
  return () => {
    client.off(RoomStateEvent.Events, onState);
  };
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
