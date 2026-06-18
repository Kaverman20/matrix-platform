import { useEffect, useMemo, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  getPinnedEventIds,
  mapPinnedMessages,
  subscribeTimeline,
  type MatrixPinnedMessage,
} from "@matrix-platform/matrix-core";

export type PinnedMessage = MatrixPinnedMessage;

export function usePinnedMessages(
  client: MatrixClient | null,
  roomId: string | null,
  overrideIds: string[] | null = null,
): PinnedMessage[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client || !roomId) return;

    // Re-map when pinned state or timeline events change — pinned previews need
    // findEventById, which only succeeds after history has synced/loaded.
    return subscribeTimeline(client, roomId, () => setVersion((value) => value + 1));
  }, [client, roomId]);

  return useMemo(() => {
    void version;
    return mapPinnedMessages(client, roomId, getPinnedEventIds(client, roomId, overrideIds));
  }, [client, roomId, version, overrideIds]);
}
