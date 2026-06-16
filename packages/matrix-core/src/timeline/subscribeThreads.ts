import {
  ClientEvent,
  RoomEvent,
  ThreadEvent,
  type MatrixClient,
  type Thread,
} from "matrix-js-sdk";
import { ensureThread, loadAllRoomThreads, loadRoomThreads } from "./threads";

export function subscribeRoomThreads(
  client: MatrixClient,
  roomId: string,
  onChange: () => void,
): () => void {
  const room = client.getRoom(roomId);
  if (!room) return () => undefined;

  void loadRoomThreads(client, roomId);

  room.on(ThreadEvent.New, onChange);
  room.on(ThreadEvent.Update, onChange);
  room.on(ThreadEvent.NewReply, onChange);

  return () => {
    room.off(ThreadEvent.New, onChange);
    room.off(ThreadEvent.Update, onChange);
    room.off(ThreadEvent.NewReply, onChange);
  };
}

export function subscribeAllThreads(
  client: MatrixClient,
  onChange: () => void,
): () => void {
  void loadAllRoomThreads(client).then(onChange);

  client.on(RoomEvent.Timeline, onChange);
  client.on(RoomEvent.Receipt, onChange);
  client.on(ClientEvent.Sync, onChange);

  return () => {
    client.off(RoomEvent.Timeline, onChange);
    client.off(RoomEvent.Receipt, onChange);
    client.off(ClientEvent.Sync, onChange);
  };
}

export function subscribeThreadTimeline(
  client: MatrixClient,
  roomId: string,
  rootId: string,
  onChange: () => void,
): () => void {
  const room = client.getRoom(roomId);
  if (!room) return () => undefined;

  // The SDK may not have a live Thread object yet (fresh thread / outside the
  // synced window). Create it so replies load and live updates flow.
  ensureThread(client, roomId, rootId);

  let thread: Thread | null = room.getThread(rootId);

  // Replies, edits and reactions inside a thread are emitted on the Thread
  // object itself. Attach directly, then re-attach if the SDK creates it after
  // the panel is already open (first reply to a fresh root).
  const attach = (target: Thread) => {
    target.on(ThreadEvent.Update, onChange);
    target.on(ThreadEvent.NewReply, onChange);
    target.on(RoomEvent.Timeline, onChange);
  };
  const detach = (target: Thread) => {
    target.off(ThreadEvent.Update, onChange);
    target.off(ThreadEvent.NewReply, onChange);
    target.off(RoomEvent.Timeline, onChange);
  };

  if (thread) attach(thread);

  const onNewThread = (created: Thread) => {
    if (created.id !== rootId || created === thread) return;
    if (thread) detach(thread);
    thread = created;
    attach(created);
    onChange();
  };

  room.on(ThreadEvent.New, onNewThread);
  room.on(RoomEvent.Timeline, onChange);
  room.on(RoomEvent.Redaction, onChange);
  // Client-level catch-all: re-emitted for every room/thread timeline change
  // plus local echoes, so a sent reply shows immediately.
  client.on(RoomEvent.Timeline, onChange);
  client.on(RoomEvent.LocalEchoUpdated, onChange);
  client.on(ClientEvent.Sync, onChange);

  onChange();

  return () => {
    if (thread) detach(thread);
    room.off(ThreadEvent.New, onNewThread);
    room.off(RoomEvent.Timeline, onChange);
    room.off(RoomEvent.Redaction, onChange);
    client.off(RoomEvent.Timeline, onChange);
    client.off(RoomEvent.LocalEchoUpdated, onChange);
    client.off(ClientEvent.Sync, onChange);
  };
}
