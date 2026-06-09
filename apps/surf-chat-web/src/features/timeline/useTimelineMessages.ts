import { useEffect, useMemo, useState } from "react";
import { RoomEvent, RoomStateEvent, ThreadEvent, type MatrixClient } from "matrix-js-sdk";
import {
  buildTimelineMessages,
  type MatrixMessage,
} from "@matrix-platform/matrix-core";

export function useTimelineMessages(
  client: MatrixClient | null,
  roomId: string | null,
  refreshKey = 0,
): MatrixMessage[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    const bump = () => setVersion((value) => value + 1);

    room.on(RoomEvent.Timeline, bump);
    room.on(RoomEvent.Redaction, bump);
    room.on(ThreadEvent.New, bump);
    room.on(ThreadEvent.Update, bump);
    room.on(ThreadEvent.NewReply, bump);
    client.on(RoomStateEvent.Events, bump);

    bump();

    return () => {
      room.off(RoomEvent.Timeline, bump);
      room.off(RoomEvent.Redaction, bump);
      room.off(ThreadEvent.New, bump);
      room.off(ThreadEvent.Update, bump);
      room.off(ThreadEvent.NewReply, bump);
      client.off(RoomStateEvent.Events, bump);
    };
  }, [client, roomId]);

  return useMemo(() => {
    void version;
    void refreshKey;
    if (!client || !roomId) return [];
    return buildTimelineMessages(client, roomId);
  }, [client, roomId, version, refreshKey]);
}
