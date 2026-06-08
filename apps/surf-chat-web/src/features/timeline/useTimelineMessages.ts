import { useEffect, useMemo, useState } from "react";
import { RoomEvent, type MatrixClient } from "matrix-js-sdk";
import {
  buildTimelineMessages,
  type MatrixMessage,
} from "@matrix-platform/matrix-core";

export function useTimelineMessages(
  client: MatrixClient | null,
  roomId: string | null,
): MatrixMessage[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    const bump = () => setVersion((value) => value + 1);

    room.on(RoomEvent.Timeline, bump);
    room.on(RoomEvent.Redaction, bump);

    bump();

    return () => {
      room.off(RoomEvent.Timeline, bump);
      room.off(RoomEvent.Redaction, bump);
    };
  }, [client, roomId]);

  return useMemo(() => {
    void version;
    if (!client || !roomId) return [];
    return buildTimelineMessages(client, roomId);
  }, [client, roomId, version]);
}
