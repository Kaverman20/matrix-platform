import { EventType, RelationType, type MatrixClient } from "matrix-js-sdk";

export type MessageEditEntry = {
  eventId: string;
  body: string;
  formattedBody?: string;
  timestamp: number;
  sender: string;
};

/** Collect edit versions for a message, oldest first. */
export function getMessageEditHistory(
  client: MatrixClient,
  roomId: string,
  eventId: string,
): MessageEditEntry[] {
  const room = client.getRoom(roomId);
  const root = room?.findEventById(eventId);
  if (!room || !root) return [];

  const history: MessageEditEntry[] = [];
  const rootContent = root.getContent();
  const rootBody = typeof rootContent.body === "string" ? rootContent.body : "";
  if (rootBody) {
    history.push({
      eventId: `${eventId}:original`,
      body: rootBody,
      formattedBody:
        typeof rootContent.formatted_body === "string" ? rootContent.formatted_body : undefined,
      timestamp: root.getTs(),
      sender: root.getSender() ?? "",
    });
  }

  const relations = room.relations.getChildEventsForEvent(
    eventId,
    RelationType.Replace,
    EventType.RoomMessage,
  );

  for (const event of relations?.getRelations() ?? []) {
    const id = event.getId();
    if (!id) continue;
    const content = event.getContent();
    const newContent = content["m.new_content"] as { body?: unknown; formatted_body?: unknown } | undefined;
    const body =
      typeof newContent?.body === "string"
        ? newContent.body
        : typeof content.body === "string"
          ? content.body.replace(/^\* /, "")
          : "";
    if (!body) continue;
    history.push({
      eventId: id,
      body,
      formattedBody:
        typeof newContent?.formatted_body === "string" ? newContent.formatted_body : undefined,
      timestamp: event.getTs(),
      sender: event.getSender() ?? "",
    });
  }

  return history.sort((a, b) => a.timestamp - b.timestamp);
}
