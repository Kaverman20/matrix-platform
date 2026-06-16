import { useEffect, useMemo, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  getPinnedEventIds,
  mapPinnedMessages,
  subscribePinnedEvents,
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

    return subscribePinnedEvents(client, roomId, () => setVersion((value) => value + 1));
  }, [client, roomId]);

  return useMemo(() => {
    void version;
    return mapPinnedMessages(client, roomId, getPinnedEventIds(client, roomId, overrideIds));
  }, [client, roomId, version, overrideIds]);
}
