import { useEffect, useMemo, useState } from "react";
import { RoomEvent, RoomStateEvent, ThreadEvent, type MatrixClient } from "matrix-js-sdk";
import {
  buildTimelineMessages,
  type MatrixMessage,
} from "@matrix-platform/matrix-core";

const timelineCache = new Map<string, MatrixMessage[]>();

export function useTimelineMessages(
  client: MatrixClient | null,
  roomId: string | null,
): MatrixMessage[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    const bump = () => {
      timelineCache.set(roomId, buildTimelineMessages(client, roomId));
      setVersion((value) => value + 1);
    };

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
    if (!client || !roomId) return [];
    const cached = timelineCache.get(roomId);
    if (cached) return cached;

    const messages = buildTimelineMessages(client, roomId);
    timelineCache.set(roomId, messages);
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

      for (const roomId of roomIds) {
        if (cancelled) return;
        if (timelineCache.has(roomId)) continue;
        timelineCache.set(roomId, buildTimelineMessages(client, roomId));
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
