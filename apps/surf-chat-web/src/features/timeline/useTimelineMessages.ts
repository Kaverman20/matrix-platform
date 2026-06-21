import { useEffect, useMemo, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  buildTimelineMessages,
  subscribeTimeline,
  type MatrixMessage,
} from "@matrix-platform/matrix-core";

// Cache is scoped per client (WeakMap) so switching accounts can't serve one
// user's messages to another, and an old client's cache is GC'd with it instead
// of growing forever.
const timelineCacheByClient = new WeakMap<MatrixClient, Map<string, MatrixMessage[]>>();

function timelineCacheFor(client: MatrixClient): Map<string, MatrixMessage[]> {
  let cache = timelineCacheByClient.get(client);
  if (!cache) {
    cache = new Map();
    timelineCacheByClient.set(client, cache);
  }
  return cache;
}

export function useTimelineMessages(
  client: MatrixClient | null,
  roomId: string | null,
): MatrixMessage[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client || !roomId) return;

    const bump = () => {
      timelineCacheFor(client).set(roomId, buildTimelineMessages(client, roomId));
      setVersion((value) => value + 1);
    };

    return subscribeTimeline(client, roomId, bump);
  }, [client, roomId]);

  return useMemo(() => {
    void version;
    if (!client || !roomId) return [];
    const cache = timelineCacheFor(client);
    const cached = cache.get(roomId);
    if (cached) return cached;

    const messages = buildTimelineMessages(client, roomId);
    cache.set(roomId, messages);
    return messages;
  }, [client, roomId, version]);
}

export function usePreloadTimelineMessages(
  client: MatrixClient | null,
  roomIds: string[],
): void {
  useEffect(() => {
    if (!client || roomIds.length === 0) return;

    let cancelled = false;
    const preload = () => {
      if (cancelled) return;

      const cache = timelineCacheFor(client);
      for (const roomId of roomIds) {
        if (cancelled) return;
        if (cache.has(roomId)) continue;
        cache.set(roomId, buildTimelineMessages(client, roomId));
      }
    };

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const useIdleCallback = Boolean(idleWindow.requestIdleCallback);
    const idleId = useIdleCallback
      ? idleWindow.requestIdleCallback!(preload, { timeout: 1000 })
      : window.setTimeout(preload, 120);

    return () => {
      cancelled = true;
      if (useIdleCallback && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [client, roomIds]);
}
