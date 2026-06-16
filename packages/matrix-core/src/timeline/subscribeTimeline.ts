import {
  RoomEvent,
  RoomStateEvent,
  ThreadEvent,
  type MatrixClient,
} from "matrix-js-sdk";

export function subscribeTimeline(
  client: MatrixClient,
  roomId: string,
  onChange: () => void,
): () => void {
  const room = client.getRoom(roomId);
  if (!room) return () => undefined;

  room.on(RoomEvent.Timeline, onChange);
  room.on(RoomEvent.LocalEchoUpdated, onChange);
  room.on(RoomEvent.Receipt, onChange);
  room.on(RoomEvent.Redaction, onChange);
  room.on(ThreadEvent.New, onChange);
  room.on(ThreadEvent.Update, onChange);
  room.on(ThreadEvent.NewReply, onChange);
  client.on(RoomStateEvent.Events, onChange);

  onChange();

  return () => {
    room.off(RoomEvent.Timeline, onChange);
    room.off(RoomEvent.LocalEchoUpdated, onChange);
    room.off(RoomEvent.Receipt, onChange);
    room.off(RoomEvent.Redaction, onChange);
    room.off(ThreadEvent.New, onChange);
    room.off(ThreadEvent.Update, onChange);
    room.off(ThreadEvent.NewReply, onChange);
    client.off(RoomStateEvent.Events, onChange);
  };
}
