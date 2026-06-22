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

/**
 * Live "bump" callbacks keyed by room id, so callers outside the hook can force
 * a rebuild. Needed for jump-to-message: `paginateToEvent` may already find the
 * target in the live timeline (e.g. loaded by global search) without emitting a
 * `Room.timeline` event, so the subscription never fires and the rendered list
 * stays stale. `refreshTimelineMessages` re-reads the live timeline on demand.
 */
const refreshers = new Map<string, Set<() => void>>();

/** Force every mounted `useTimelineMessages` for a room to rebuild its list. */
export function refreshTimelineMessages(roomId: string): void {
  refreshers.get(roomId)?.forEach((bump) => bump());
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

    let roomRefreshers = refreshers.get(roomId);
    if (!roomRefreshers) {
      roomRefreshers = new Set();
      refreshers.set(roomId, roomRefreshers);
    }
    roomRefreshers.add(bump);

    const unsubscribe = subscribeTimeline(client, roomId, bump);
    return () => {
      unsubscribe();
      roomRefreshers.delete(bump);
      if (roomRefreshers.size === 0) refreshers.delete(roomId);
    };
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
