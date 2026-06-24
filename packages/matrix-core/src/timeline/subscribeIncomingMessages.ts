import {
  MatrixEventEvent,
  RoomEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from "matrix-js-sdk";

export type IncomingMessage = {
  roomId: string;
  eventId: string | undefined;
  /** Event origin timestamp (ms). */
  ts: number;
};

/**
 * Fires `onIncoming` for every *live* incoming `m.room.message` across all
 * rooms — i.e. a message from someone else that just arrived (not our own
 * echo, not backfilled history, not redactions). Used to drive notification
 * sound/badges globally rather than only for the open room.
 *
 * Encrypted rooms: the live event first lands as `m.room.encrypted` and is
 * decrypted asynchronously, so we also listen for `MatrixEventEvent.Decrypted`
 * and re-evaluate once the clear type is known.
 */
export function subscribeIncomingMessages(
  client: MatrixClient,
  onIncoming: (message: IncomingMessage) => void,
): () => void {
  const myUserId = client.getUserId();

  const emit = (event: MatrixEvent, room: Room | null | undefined) => {
    if (!room) return;
    if (event.getType() !== "m.room.message") return;
    if (event.getSender() === myUserId) return;
    onIncoming({
      roomId: room.roomId,
      eventId: event.getId(),
      ts: event.getTs(),
    });
  };

  const onTimeline = (
    event: MatrixEvent,
    room: Room | undefined,
    toStartOfTimeline: boolean | undefined,
    removed: boolean,
    data?: { liveEvent?: boolean },
  ) => {
    // Only freshly received live events — skip pagination/backfill and removals.
    if (toStartOfTimeline || removed || !data?.liveEvent) return;
    if (event.isEncrypted() && event.getType() === "m.room.encrypted") return;
    emit(event, room);
  };

  const onDecrypted = (event: MatrixEvent) => {
    if (!event.isEncrypted()) return;
    emit(event, client.getRoom(event.getRoomId() ?? ""));
  };

  client.on(RoomEvent.Timeline, onTimeline);
  client.on(MatrixEventEvent.Decrypted, onDecrypted);

  return () => {
    client.off(RoomEvent.Timeline, onTimeline);
    client.off(MatrixEventEvent.Decrypted, onDecrypted);
  };
}
