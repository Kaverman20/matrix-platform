import { useEffect, useMemo, useState } from "react";
import { ThreadEvent, type MatrixClient } from "matrix-js-sdk";
import {
  getRoomThreadSummaries,
  loadRoomThreads,
  type MatrixThreadListItem,
} from "@matrix-platform/matrix-core";

/** Live list of all threads in a room (loads historical threads on open). */
export function useRoomThreads(
  client: MatrixClient | null,
  roomId: string | null,
): MatrixThreadListItem[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    void loadRoomThreads(client, roomId);

    const bump = () => setVersion((value) => value + 1);
    room.on(ThreadEvent.New, bump);
    room.on(ThreadEvent.Update, bump);
    room.on(ThreadEvent.NewReply, bump);

    return () => {
      room.off(ThreadEvent.New, bump);
      room.off(ThreadEvent.Update, bump);
      room.off(ThreadEvent.NewReply, bump);
    };
  }, [client, roomId]);

  return useMemo(() => {
    void version;
    if (!client || !roomId) return [];
    return getRoomThreadSummaries(client, roomId);
  }, [client, roomId, version]);
}
