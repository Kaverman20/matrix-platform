import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { colorForId } from "../rooms/colors";
import type { MatrixMessage } from "./messageTypes";

export function buildTimelineMessages(
  client: MatrixClient,
  roomId: string,
): MatrixMessage[] {
  const room = client.getRoom(roomId);
  if (!room) return [];

  return buildMessagesFromEvents(client, room, room.getLiveTimeline().getEvents());
}

function buildMessagesFromEvents(
  client: MatrixClient,
  room: Room,
  events: MatrixEvent[],
): MatrixMessage[] {
  const me = client.getUserId();

  return events
    .filter((event) => isRealMessageEvent(event))
    .map((event, index) => {
      const sender = event.getSender() ?? "";
      const member = room.getMember(sender);
      const eventId = event.getId() ?? event.getTxnId() ?? `${sender}:${event.getTs()}:${index}`;
      const text = getEffectiveText(event);

      return {
        id: eventId,
        sender,
        author: member?.name || sender,
        time: formatTime(event.getTs()),
        timestamp: event.getTs(),
        text: text.value,
        color: colorForId(sender),
        avatarUrl: getMemberAvatarUrl(client, member),
        own: sender === me,
        edited: text.edited,
      };
    });
}

function isRealMessageEvent(event: MatrixEvent): boolean {
  if (event.getType() !== "m.room.message") return false;
  if (event.isRedacted()) return false;

  const content = event.getContent();
  const relation = content["m.relates_to"] as { rel_type?: string } | undefined;
  return relation?.rel_type !== "m.replace";
}

function getEffectiveText(event: MatrixEvent): { value: string; edited: boolean } {
  const replacingEvent = event.replacingEvent();
  if (replacingEvent) {
    const newContent = replacingEvent.getContent()["m.new_content"] as
      | { body?: unknown }
      | undefined;
    if (typeof newContent?.body === "string") {
      return { value: newContent.body, edited: true };
    }
  }

  const body = event.getContent().body;
  return { value: typeof body === "string" ? body : "", edited: false };
}

function getMemberAvatarUrl(
  client: MatrixClient,
  member: ReturnType<Room["getMember"]>,
): string | undefined {
  const mxc = member?.getMxcAvatarUrl?.();
  if (!mxc) return undefined;
  return client.mxcUrlToHttp(mxc, 64, 64, "crop", false, true, true) ?? undefined;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

