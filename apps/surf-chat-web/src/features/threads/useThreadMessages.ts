import { useEffect, useMemo, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  buildThreadMessages,
  subscribeThreadTimeline,
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

    const bump = () => setVersion((value) => value + 1);
    return subscribeThreadTimeline(client, roomId, rootId, bump);
  }, [client, roomId, rootId]);

  return useMemo(() => {
    void version;
    if (!client || !roomId || !rootId) return [];
    return buildThreadMessages(client, roomId, rootId);
  }, [client, roomId, rootId, version]);
}
