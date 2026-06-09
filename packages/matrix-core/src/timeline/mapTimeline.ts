import { EventTimeline, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk";
import { colorForId } from "../rooms/colors";
import type {
  MatrixMessage,
  MatrixMedia,
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
  const pinnedIds = getPinnedEventIds(room);
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
      const content = event.getContent();

      return {
        id: eventId,
        sender,
        author: member?.name || sender,
        time: formatTime(event.getTs()),
        timestamp: event.getTs(),
        text: text.value,
        color: colorForId(sender),
        avatarUrl: getMemberAvatarUrl(client, member),
        media: resolveMedia(client, content),
        own: sender === me,
        edited: text.edited,
        forwardedFrom: getForwardedFrom(event),
        reactions: reactionsByTarget.get(eventId) ?? [],
        replyTo: getReplyReference(room, event, eventById),
        pinned: pinnedIds.has(eventId),
      };
    });
}

function getPinnedEventIds(room: Room): Set<string> {
  const pinned =
    (room
      .getLiveTimeline()
      .getState(EventTimeline.FORWARDS)
      ?.getStateEvents("m.room.pinned_events", "")
      ?.getContent().pinned as string[] | undefined) ?? [];

  return new Set(pinned);
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

function resolveMedia(
  client: MatrixClient,
  content: Record<string, unknown>,
): MatrixMedia | undefined {
  const kindByMsgType: Record<string, MatrixMedia["kind"]> = {
    "m.image": "image",
    "m.video": "video",
    "m.file": "file",
    "m.audio": "audio",
  };
  const msgtype = typeof content.msgtype === "string" ? content.msgtype : undefined;
  const kind = msgtype ? kindByMsgType[msgtype] : undefined;
  if (!kind) return undefined;

  const file = content.file as { url?: unknown } | undefined;
  const mxc = typeof content.url === "string"
    ? content.url
    : typeof file?.url === "string"
      ? file.url
      : undefined;
  if (!mxc) return undefined;

  const info = (content.info ?? {}) as {
    mimetype?: unknown;
    size?: unknown;
    w?: unknown;
    h?: unknown;
    thumbnail_url?: unknown;
    duration?: unknown;
  };
  const mscAudio = content["org.matrix.msc1767.audio"] as
    | { duration?: unknown }
    | undefined;
  const thumbMxc = typeof info.thumbnail_url === "string" ? info.thumbnail_url : undefined;
  const url = client.mxcUrlToHttp(mxc, undefined, undefined, undefined, false, true, true);
  if (!url) return undefined;
  const thumbUrl = thumbMxc
    ? client.mxcUrlToHttp(thumbMxc, 600, 600, "scale", false, true, true) ?? undefined
    : kind === "image" || kind === "video"
      ? client.mxcUrlToHttp(mxc, 600, 600, "scale", false, true, true) ?? url
      : undefined;

  return {
    kind,
    url,
    thumbUrl,
    name: typeof content.body === "string" ? content.body : "Файл",
    mimetype: typeof info.mimetype === "string" ? info.mimetype : undefined,
    size: typeof info.size === "number" ? info.size : undefined,
    width: typeof info.w === "number" ? info.w : undefined,
    height: typeof info.h === "number" ? info.h : undefined,
    durationMs: typeof info.duration === "number"
      ? info.duration
      : typeof mscAudio?.duration === "number"
        ? mscAudio.duration
        : undefined,
    voice: Boolean(content["org.matrix.msc3245.voice"]),
  };
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
