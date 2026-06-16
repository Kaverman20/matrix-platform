import { useEffect, useMemo, useState } from "react";
import { EventTimeline, RoomStateEvent, type MatrixClient } from "matrix-js-sdk";
import { colorForId, type MatrixMessageReference } from "@matrix-platform/matrix-core";

export type PinnedMessage = MatrixMessageReference & {
  color?: string;
};

export function usePinnedMessages(
  client: MatrixClient | null,
  roomId: string | null,
  overrideIds: string[] | null = null,
): PinnedMessage[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client || !roomId) return;

    const bump = () => setVersion((value) => value + 1);
    client.on(RoomStateEvent.Events, bump);

    return () => {
      client.off(RoomStateEvent.Events, bump);
    };
  }, [client, roomId]);

  return useMemo(() => {
    void version;
    if (!client || !roomId) return [];

    const room = client.getRoom(roomId);
    if (!room) return [];

    const pinnedIds = overrideIds
      ?? (room.currentState.getStateEvents("m.room.pinned_events", "")?.getContent().pinned as string[] | undefined)
      ?? (room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.pinned_events", "")
        ?.getContent().pinned as string[] | undefined)
      ?? [];

    return pinnedIds
      .map<PinnedMessage | null>((id) => {
        const event = room.findEventById(id);
        if (!event || event.isRedacted() || event.getType() !== "m.room.message") {
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
      .filter((message): message is PinnedMessage => message !== null);
  }, [client, roomId, version, overrideIds]);
}
