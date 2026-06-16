import { useEffect, useMemo, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  getRoomThreadSummaries,
  subscribeRoomThreads,
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

    const bump = () => setVersion((value) => value + 1);
    return subscribeRoomThreads(client, roomId, bump);
  }, [client, roomId]);

  return useMemo(() => {
    void version;
    if (!client || !roomId) return [];
    return getRoomThreadSummaries(client, roomId);
  }, [client, roomId, version]);
}
