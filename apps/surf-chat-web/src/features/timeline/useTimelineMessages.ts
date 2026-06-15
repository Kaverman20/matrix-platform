import { useEffect, useMemo, useState } from "react";
import { RoomEvent, RoomStateEvent, ThreadEvent, type MatrixClient } from "matrix-js-sdk";
import {
  buildTimelineMessages,
  canPaginateBackwards,
  paginateBackwards,
  type MatrixMessage,
} from "@matrix-platform/matrix-core";

const timelineCache = new Map<string, MatrixMessage[]>();
const warmedRooms = new Set<string>();
const activeWarmedRooms = new Set<string>();

const BACKGROUND_ROOM_LIMIT = 8;
const BACKGROUND_PAGE_LIMIT = 60;
const ACTIVE_PAGE_LIMIT = 120;
const ACTIVE_WARM_PAGES = 2;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

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
  activeRoomId?: string | null,
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

  useEffect(() => {
    if (!client || roomIds.length === 0) return;

    let cancelled = false;

    const warmRoom = async (roomId: string, pages: number, limit: number) => {
      for (let page = 0; page < pages; page += 1) {
        if (cancelled || !canPaginateBackwards(client, roomId)) return;
        const added = await paginateBackwards(client, roomId, limit);
        timelineCache.set(roomId, buildTimelineMessages(client, roomId));
        if (!added) return;
        await wait(80);
      }
    };

    const run = async () => {
      if (activeRoomId && !activeWarmedRooms.has(activeRoomId)) {
        activeWarmedRooms.add(activeRoomId);
        await warmRoom(activeRoomId, ACTIVE_WARM_PAGES, ACTIVE_PAGE_LIMIT);
      }

      const backgroundRooms = roomIds
        .filter((roomId) => roomId !== activeRoomId && !warmedRooms.has(roomId))
        .slice(0, BACKGROUND_ROOM_LIMIT);

      for (const roomId of backgroundRooms) {
        if (cancelled) return;
        warmedRooms.add(roomId);
        await warmRoom(roomId, 1, BACKGROUND_PAGE_LIMIT);
        await wait(120);
      }
    };

    const timer = window.setTimeout(() => {
      void run();
    }, activeRoomId ? 250 : 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [client, roomIds, activeRoomId]);
}
