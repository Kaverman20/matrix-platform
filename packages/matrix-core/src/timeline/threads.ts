import { EventTimeline, EventType, MsgType, RelationType, type MatrixClient, type Room } from "matrix-js-sdk";

export const THREAD_REL_TYPE = "m.thread";

export type MatrixThreadListItem = {
  rootId: string;
  rootText: string;
  rootAuthor: string;
  replyCount: number;
  lastAuthor?: string;
  lastTs: number;
  unread: boolean;
};

/**
 * Load the room's historical threads from the server so thread roots are known
 * (chips in the timeline + the threads list). Safe to call repeatedly.
 */
export async function loadRoomThreads(
  client: MatrixClient,
  roomId: string,
): Promise<void> {
  const room = client.getRoom(roomId);
  if (!room) return;
  try {
    if (room.threadsTimelineSets.length === 0) {
      await room.createThreadsTimelineSets();
    }
    await room.fetchRoomThreads();
  } catch (error) {
    console.error("[matrix-core] loadRoomThreads failed", error);
  }
}

/** Summaries of every known thread in a room, most recently active first. */
export function getRoomThreadSummaries(
  client: MatrixClient,
  roomId: string,
): MatrixThreadListItem[] {
  const room = client.getRoom(roomId);
  if (!room) return [];

  return room
    .getThreads()
    .map((thread) => {
      const root = thread.rootEvent;
      const rootSender = root?.getSender() ?? "";
      const lastSender = thread.replyToEvent?.getSender() ?? "";
      return {
        rootId: thread.id,
        rootText: bodyOf(root) || "Сообщение",
        rootAuthor: memberName(room, rootSender),
        replyCount: thread.length,
        lastAuthor: lastSender ? memberName(room, lastSender) : undefined,
        lastTs: thread.replyToEvent?.getTs() ?? root?.getTs() ?? 0,
        unread: room.getThreadUnreadNotificationCount(thread.id) > 0,
      };
    })
    .sort((a, b) => b.lastTs - a.lastTs);
}

export type MatrixGlobalThreadItem = MatrixThreadListItem & {
  roomId: string;
  roomName: string;
};

/** Load threads for every joined room (for the global threads view). */
export async function loadAllRoomThreads(client: MatrixClient): Promise<void> {
  const rooms = client
    .getRooms()
    .filter((room) => room.getMyMembership() === "join" && !room.isSpaceRoom());
  await Promise.all(rooms.map((room) => loadRoomThreads(client, room.roomId)));
}

/** Every known thread across all joined rooms, most recently active first. */
export function getAllThreadSummaries(client: MatrixClient): MatrixGlobalThreadItem[] {
  const rooms = client
    .getRooms()
    .filter((room) => room.getMyMembership() === "join" && !room.isSpaceRoom());

  const items: MatrixGlobalThreadItem[] = [];
  for (const room of rooms) {
    for (const thread of getRoomThreadSummaries(client, room.roomId)) {
      items.push({ ...thread, roomId: room.roomId, roomName: room.name || room.roomId });
    }
  }
  return items.sort((a, b) => b.lastTs - a.lastTs);
}

function bodyOf(event: ReturnType<Room["findEventById"]> | undefined): string {
  const body = event?.getContent?.().body;
  return typeof body === "string" ? body : "";
}

function memberName(room: Room, userId: string): string {
  if (!userId) return "";
  return room.getMember(userId)?.name || userId;
}

/** Send a message as a reply inside a thread rooted at `rootId`. */
export async function sendThreadReply(
  client: MatrixClient,
  roomId: string,
  rootId: string,
  text: string,
  replyToId?: string,
): Promise<void> {
  const body = text.trim();
  if (!body) return;

  const thread = client.getRoom(roomId)?.getThread(rootId);
  // When replying to a specific message it's a real reply (rendered as a quote);
  // otherwise we attach a fallback in_reply_to to the latest thread event so
  // non-thread-aware clients still thread it sensibly.
  const inReplyTo = replyToId ?? thread?.lastReply()?.getId() ?? rootId;

  await client.sendEvent(roomId, EventType.RoomMessage, {
    msgtype: MsgType.Text,
    body,
    "m.relates_to": {
      rel_type: RelationType.Thread,
      event_id: rootId,
      is_falling_back: !replyToId,
      "m.in_reply_to": { event_id: inReplyTo },
    },
  } as never);
}

/**
 * Make sure a Thread object exists for `rootId`. The SDK doesn't always
 * materialise a thread live (e.g. right after the first reply, or for threads
 * outside the synced window), which left freshly-created threads empty until a
 * reload. Creating it explicitly loads its replies and lets live updates flow.
 */
export function ensureThread(
  client: MatrixClient,
  roomId: string,
  rootId: string,
): void {
  const room = client.getRoom(roomId);
  if (!room || room.getThread(rootId)) return;

  const rootEvent = room.findEventById(rootId);
  if (!rootEvent) return;

  try {
    room.createThread(rootId, rootEvent, undefined, false);
  } catch (error) {
    console.error("[matrix-core] ensureThread failed", error);
  }
}

/** Mark a thread read so its unread notification count clears server-side. */
export async function markThreadRead(
  client: MatrixClient,
  roomId: string,
  rootId: string,
): Promise<void> {
  const thread = client.getRoom(roomId)?.getThread(rootId);
  if (!thread) return;

  const last = thread.lastReply() ?? thread.rootEvent;
  if (!last) return;

  try {
    // The SDK derives the thread id from the event, so this is a threaded receipt.
    await client.sendReadReceipt(last);
  } catch (error) {
    console.error("[matrix-core] markThreadRead failed", error);
  }
}

/** Whether older thread replies can be loaded above the current window. */
export function canPaginateThreadBackwards(
  client: MatrixClient,
  roomId: string,
  rootId: string,
): boolean {
  const thread = client.getRoom(roomId)?.getThread(rootId);
  if (!thread) return false;
  return thread.liveTimeline.getPaginationToken(EventTimeline.BACKWARDS) !== null;
}

/** Load one older page of thread history. Returns true when new events appeared. */
export async function paginateThreadBackwards(
  client: MatrixClient,
  roomId: string,
  rootId: string,
  limit = 50,
): Promise<boolean> {
  const thread = client.getRoom(roomId)?.getThread(rootId);
  if (!thread) return false;

  const timeline = thread.liveTimeline;
  if (timeline.getPaginationToken(EventTimeline.BACKWARDS) === null) return false;

  const before = countThreadMessages(thread);
  try {
    await client.paginateEventTimeline(timeline, { backwards: true, limit });
  } catch (error) {
    console.error("[matrix-core] paginateThreadBackwards failed", error);
    return false;
  }

  return countThreadMessages(thread) > before;
}

function countThreadMessages(thread: NonNullable<ReturnType<Room["getThread"]>>): number {
  return thread.events.filter(
    (event) => event.getType() === "m.room.message" && !event.isRedacted(),
  ).length;
}
