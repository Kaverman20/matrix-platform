import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { colorForId } from "../rooms/colors";
import type { MatrixMessage, MatrixMessageReference } from "./messageTypes";
import { FORWARD_KEY } from "./sendMessage";

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
  const eventById = new Map(
    events
      .map((event) => [event.getId(), event] as const)
      .filter((entry): entry is [string, MatrixEvent] => Boolean(entry[0])),
  );

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
        forwardedFrom: getForwardedFrom(event),
        replyTo: getReplyReference(room, event, eventById),
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

function getForwardedFrom(event: MatrixEvent): string | undefined {
  const forward = event.getContent()[FORWARD_KEY] as
    | { author?: unknown }
    | undefined;
  return typeof forward?.author === "string" ? forward.author : undefined;
}

function getReplyReference(
  room: Room,
  event: MatrixEvent,
  eventById: Map<string, MatrixEvent>,
): MatrixMessageReference | undefined {
  const relation = event.getContent()["m.relates_to"] as
    | { "m.in_reply_to"?: { event_id?: unknown } }
    | undefined;
  const eventId = relation?.["m.in_reply_to"]?.event_id;
  if (typeof eventId !== "string" || !eventId) return undefined;

  const repliedEvent = eventById.get(eventId);
  if (!repliedEvent) return { id: eventId };

  const sender = repliedEvent.getSender() ?? undefined;
  const member = sender ? room.getMember(sender) : undefined;

  return {
    id: eventId,
    sender,
    author: member?.name || sender,
    text: getEffectiveText(repliedEvent).value,
  };
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
