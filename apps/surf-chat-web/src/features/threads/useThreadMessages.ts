import { useEffect, useMemo, useState } from "react";
import {
  ClientEvent,
  RoomEvent,
  ThreadEvent,
  type MatrixClient,
  type Thread,
} from "matrix-js-sdk";
import {
  buildThreadMessages,
  ensureThread,
  type MatrixMessage,
} from "@matrix-platform/matrix-core";

/** Live messages (root + replies) for an open thread. */
export function useThreadMessages(
  client: MatrixClient | null,
  roomId: string | null,
  rootId: string | null,
): MatrixMessage[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client || !roomId || !rootId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    const bump = () => setVersion((value) => value + 1);

    // The SDK may not have a live Thread object yet (fresh thread / outside the
    // synced window). Create it so its replies load and live updates flow.
    ensureThread(client, roomId, rootId);

    // Replies, edits and reactions inside a thread are emitted on the Thread
    // object itself — listening only on the room misses them, so the panel went
    // stale until reload. Attach to the thread directly, and re-attach if the
    // thread is created after we opened (first reply to a fresh root).
    let thread: Thread | null = room.getThread(rootId);

    const attach = (target: Thread) => {
      target.on(ThreadEvent.Update, bump);
      target.on(ThreadEvent.NewReply, bump);
      target.on(RoomEvent.Timeline, bump);
    };
    const detach = (target: Thread) => {
      target.off(ThreadEvent.Update, bump);
      target.off(ThreadEvent.NewReply, bump);
      target.off(RoomEvent.Timeline, bump);
    };

    if (thread) attach(thread);

    const onNewThread = (created: Thread) => {
      if (created.id !== rootId || created === thread) return;
      if (thread) detach(thread);
      thread = created;
      attach(created);
      bump();
    };

    room.on(ThreadEvent.New, onNewThread);
    room.on(RoomEvent.Timeline, bump);
    room.on(RoomEvent.Redaction, bump);
    // Client-level catch-all: re-emitted for every room/thread timeline change
    // plus local echoes, so a sent reply shows immediately.
    client.on(RoomEvent.Timeline, bump);
    client.on(RoomEvent.LocalEchoUpdated, bump);
    client.on(ClientEvent.Sync, bump);

    bump();

    return () => {
      if (thread) detach(thread);
      room.off(ThreadEvent.New, onNewThread);
      room.off(RoomEvent.Timeline, bump);
      room.off(RoomEvent.Redaction, bump);
      client.off(RoomEvent.Timeline, bump);
      client.off(RoomEvent.LocalEchoUpdated, bump);
      client.off(ClientEvent.Sync, bump);
    };
  }, [client, roomId, rootId]);

  return useMemo(() => {
    void version;
    if (!client || !roomId || !rootId) return [];
    return buildThreadMessages(client, roomId, rootId);
  }, [client, roomId, rootId, version]);
}
