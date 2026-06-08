import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { colorForId } from "../rooms/colors";
import type {
  MatrixMessage,
  MatrixMessageReference,
  MatrixReaction,
} from "./messageTypes";
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
  const reactionsByTarget = buildReactionAggregates(room, events, me);
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
        reactions: reactionsByTarget.get(eventId) ?? [],
        replyTo: getReplyReference(room, event, eventById),
      };
    });
}

function buildReactionAggregates(
  room: Room,
  events: MatrixEvent[],
  me: string | null,
): Map<string, MatrixReaction[]> {
  type Aggregate = {
    count: number;
    mine: boolean;
    myEventId?: string;
    senders: string[];
  };

  const byTarget = new Map<string, Map<string, Aggregate>>();

  for (const event of events) {
    if (event.getType() !== "m.reaction" || event.isRedacted()) continue;

    const relation = event.getContent()["m.relates_to"] as
      | { rel_type?: unknown; event_id?: unknown; key?: unknown }
      | undefined;
    if (relation?.rel_type !== "m.annotation") continue;
    if (typeof relation.event_id !== "string" || typeof relation.key !== "string") continue;

    const sender = event.getSender() ?? "";
    const senderName = room.getMember(sender)?.name || sender;
    const byKey = byTarget.get(relation.event_id) ?? new Map<string, Aggregate>();
    const aggregate = byKey.get(relation.key) ?? {
      count: 0,
      mine: false,
      senders: [],
    };

    aggregate.count += 1;
    aggregate.senders.push(senderName);
    if (sender === me) {
      aggregate.mine = true;
      aggregate.myEventId = event.getId() ?? event.getTxnId();
    }

    byKey.set(relation.key, aggregate);
    byTarget.set(relation.event_id, byKey);
  }

  return new Map(
    Array.from(byTarget.entries()).map(([targetId, byKey]) => [
      targetId,
      Array.from(byKey.entries())
        .map(([key, aggregate]) => ({ key, ...aggregate }))
        .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    ]),
  );
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
