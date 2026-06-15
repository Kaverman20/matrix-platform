import { EventStatus, EventTimeline, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk";
import { colorForId } from "../rooms/colors";
import type {
  MatrixMessage,
  MatrixDeliveryStatus,
  MatrixMedia,
  MatrixMessageReference,
  MatrixReaction,
  MatrixThreadSummary,
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

/** Messages inside a single thread (root + replies), oldest first. */
export function buildThreadMessages(
  client: MatrixClient,
  roomId: string,
  rootId: string,
): MatrixMessage[] {
  const room = client.getRoom(roomId);
  if (!room) return [];

  const thread = room.getThread(rootId);
  if (!thread) {
    // No replies yet — show just the root so a new thread can be started.
    const root = room.findEventById(rootId);
    return root ? buildMessagesFromEvents(client, room, [root]) : [];
  }

  const events = [...thread.timeline];
  // Ensure the root message leads the thread even if it isn't in the thread's
  // own timeline array.
  if (thread.rootEvent && !events.some((event) => event.getId() === rootId)) {
    events.unshift(thread.rootEvent);
  }

  return buildMessagesFromEvents(client, room, events);
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
    .map((event, index): MatrixMessage | null => {
      const sender = event.getSender() ?? "";
      const member = room.getMember(sender);
      const eventId = event.getId() ?? event.getTxnId() ?? `${sender}:${event.getTs()}:${index}`;
      const systemText = getSystemEventText(room, event);
      if (systemText) {
        return {
          id: eventId,
          kind: "system",
          sender,
          author: member?.name || sender,
          time: formatTime(event.getTs()),
          timestamp: event.getTs(),
          text: systemText,
          color: colorForId(sender),
          own: false,
          edited: false,
          reactions: [],
        };
      }

      if (!isRealMessageEvent(event)) return null;

      const own = sender === me;
      const text = getEffectiveText(event);
      const content = event.getContent();

      return {
        id: eventId,
        kind: "message",
        sender,
        author: member?.name || sender,
        time: formatTime(event.getTs()),
        timestamp: event.getTs(),
        text: text.value,
        color: colorForId(sender),
        avatarUrl: getMemberAvatarUrl(client, member),
        media: resolveMedia(client, content),
        own,
        deliveryStatus: own ? getDeliveryStatus(room, event, eventId, me) : undefined,
        edited: text.edited,
        forwardedFrom: getForwardedFrom(event),
        reactions: reactionsByTarget.get(eventId) ?? [],
        replyTo: getReplyReference(room, event, eventById),
        pinned: pinnedIds.has(eventId),
        thread: getThreadSummary(room, eventId),
      };
    })
    .filter((message): message is MatrixMessage => Boolean(message));
}

function getDeliveryStatus(
  room: Room,
  event: MatrixEvent,
  eventId: string,
  me: string | null,
): MatrixDeliveryStatus {
  if (event.status === EventStatus.NOT_SENT || event.status === EventStatus.CANCELLED) {
    return "error";
  }

  if (
    event.status === EventStatus.SENDING ||
    event.status === EventStatus.QUEUED ||
    event.status === EventStatus.ENCRYPTING ||
    eventId.startsWith("~")
  ) {
    return "sending";
  }

  if (eventId && me && hasOtherUserReadEvent(room, eventId, me)) {
    return "read";
  }

  return "sent";
}

function hasOtherUserReadEvent(room: Room, eventId: string, me: string): boolean {
  return room
    .getJoinedMembers()
    .some((member) => member.userId !== me && room.hasUserReadEvent(member.userId, eventId));
}

function getThreadSummary(room: Room, rootId: string): MatrixThreadSummary | undefined {
  const thread = room.getThread(rootId);
  if (!thread || thread.length === 0) return undefined;

  const lastSender = thread.replyToEvent?.getSender() ?? "";
  const lastAuthor = lastSender
    ? room.getMember(lastSender)?.name || lastSender
    : undefined;

  return {
    count: thread.length,
    lastAuthor,
    unread: room.getThreadUnreadNotificationCount(rootId) > 0,
  };
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

function getSystemEventText(room: Room, event: MatrixEvent): string | null {
  if (event.isRedacted()) return null;

  const type = event.getType();
  const sender = event.getSender() ?? "";
  const actor = room.getMember(sender)?.name || sender;
  const content = event.getContent();

  switch (type) {
    case "m.room.create":
      return "Комната создана";
    case "m.room.name": {
      const name = typeof content.name === "string" ? content.name.trim() : "";
      return name ? `${actor} изменил название на «${name}»` : `${actor} удалил название комнаты`;
    }
    case "m.room.topic": {
      const topic = typeof content.topic === "string" ? content.topic.trim() : "";
      return topic ? `${actor} изменил тему комнаты` : `${actor} удалил тему комнаты`;
    }
    case "m.room.avatar":
      return typeof content.url === "string" && content.url
        ? `${actor} обновил аватар комнаты`
        : `${actor} удалил аватар комнаты`;
    case "m.room.encryption":
      return "В комнате включено шифрование";
    case "m.room.pinned_events":
      return getPinnedSystemText(event, actor);
    case "m.room.member":
      return getMemberSystemText(room, event, actor, sender);
    default:
      return null;
  }
}

function getMemberSystemText(
  room: Room,
  event: MatrixEvent,
  actor: string,
  sender: string,
): string | null {
  const targetId = event.getStateKey();
  if (!targetId) return null;

  const content = event.getContent();
  const prev = event.getPrevContent();
  const membership = typeof content.membership === "string" ? content.membership : "";
  const prevMembership = typeof prev.membership === "string" ? prev.membership : "";
  const target = room.getMember(targetId)?.name
    || (typeof content.displayname === "string" ? content.displayname : "")
    || targetId;
  const changedProfile =
    membership === "join" &&
    prevMembership === "join" &&
    (content.displayname !== prev.displayname || content.avatar_url !== prev.avatar_url);

  if (changedProfile) return null;

  if (membership === "invite") {
    return sender === targetId ? `${target} получил приглашение` : `${actor} пригласил ${target}`;
  }

  if (membership === "join") {
    if (prevMembership === "invite") return `${target} принял приглашение`;
    return `${target} присоединился`;
  }

  if (membership === "leave") {
    if (prevMembership === "invite") {
      return sender === targetId ? `${target} отклонил приглашение` : `${actor} отменил приглашение для ${target}`;
    }
    return sender === targetId ? `${target} вышел` : `${actor} удалил ${target}`;
  }

  if (membership === "ban") return `${actor} заблокировал ${target}`;
  if (membership === "knock") return `${target} запросил доступ`;

  return null;
}

function getPinnedSystemText(event: MatrixEvent, actor: string): string | null {
  const current = event.getContent().pinned;
  const previous = event.getPrevContent().pinned;
  const currentCount = Array.isArray(current) ? current.length : 0;
  const previousCount = Array.isArray(previous) ? previous.length : 0;

  if (currentCount > previousCount) return `${actor} закрепил сообщение`;
  if (currentCount < previousCount) return `${actor} открепил сообщение`;
  return null;
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
    | {
        rel_type?: unknown;
        is_falling_back?: unknown;
        "m.in_reply_to"?: { event_id?: unknown };
      }
    | undefined;
  // Thread replies carry a fallback in_reply_to for non-thread clients — don't
  // render it as a visible "reply to previous" inside the thread.
  if (relation?.rel_type === "m.thread" && relation.is_falling_back) return undefined;
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
