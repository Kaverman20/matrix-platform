import { useEffect, useRef } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { findSpaceIdForRoom, type MatrixSpaceSummary } from "@matrix-platform/matrix-core";
import { pushChatToHistory, readChatUrlFromLocation } from "./chatUrl";

type Options = {
  client: MatrixClient | null;
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;
  activeSpaceId: string | null;
  setActiveSpaceId: (spaceId: string | null) => void;
  spaces: readonly MatrixSpaceSummary[];
  /** All joined room ids once sync has populated the client. */
  knownRoomIds: readonly string[];
};

/**
 * Keeps `?room=` and `?space=` in sync with the active chat and handles browser back/forward.
 */
export function useChatUrl({
  client,
  activeRoomId,
  setActiveRoomId,
  activeSpaceId,
  setActiveSpaceId,
  spaces,
  knownRoomIds,
}: Options): void {
  const skipUrlWriteRef = useRef(false);
  const inferredSpaceRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      skipUrlWriteRef.current = true;
      const { roomId, spaceId } = readChatUrlFromLocation(window.location);
      setActiveRoomId(roomId);
      setActiveSpaceId(spaceId);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setActiveRoomId, setActiveSpaceId]);

  useEffect(() => {
    if (skipUrlWriteRef.current) {
      skipUrlWriteRef.current = false;
      return;
    }

    const url = readChatUrlFromLocation(window.location);
    if (activeRoomId === url.roomId && activeSpaceId === url.spaceId) return;

    pushChatToHistory({ roomId: activeRoomId, spaceId: activeSpaceId });
  }, [activeRoomId, activeSpaceId]);

  useEffect(() => {
    if (!client || !activeRoomId) return;
    if (knownRoomIds.length === 0) return;
    if (knownRoomIds.includes(activeRoomId)) return;
    if (client.getRoom(activeRoomId)) return;

    setActiveRoomId(null);
  }, [activeRoomId, client, knownRoomIds, setActiveRoomId]);

  useEffect(() => {
    if (!client || !activeSpaceId) return;
    if (spaces.length === 0) return;
    if (spaces.some((space) => space.id === activeSpaceId)) return;

    setActiveSpaceId(null);
  }, [activeSpaceId, client, setActiveSpaceId, spaces]);

  // Legacy links and cold starts with only ?room= — infer the parent space once.
  useEffect(() => {
    if (inferredSpaceRef.current) return;
    if (!activeRoomId || spaces.length === 0) return;

    const { spaceId: urlSpaceId } = readChatUrlFromLocation(window.location);
    if (urlSpaceId) {
      inferredSpaceRef.current = true;
      return;
    }

    const inferred = findSpaceIdForRoom(spaces, activeRoomId);
    if (inferred !== activeSpaceId) {
      setActiveSpaceId(inferred);
    }
    inferredSpaceRef.current = true;
  }, [activeRoomId, activeSpaceId, setActiveSpaceId, spaces]);
}
