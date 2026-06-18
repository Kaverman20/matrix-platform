import { useEffect, useRef } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { pushRoomToHistory, readRoomIdFromLocation } from "./chatUrl";

type Options = {
  client: MatrixClient | null;
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;
  /** All joined room ids once sync has populated the client. */
  knownRoomIds: readonly string[];
};

/**
 * Keeps `?room=` in sync with the active chat and handles browser back/forward.
 */
export function useChatRoomUrl({
  client,
  activeRoomId,
  setActiveRoomId,
  knownRoomIds,
}: Options): void {
  const skipUrlWriteRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      skipUrlWriteRef.current = true;
      setActiveRoomId(readRoomIdFromLocation(window.location));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setActiveRoomId]);

  useEffect(() => {
    if (skipUrlWriteRef.current) {
      skipUrlWriteRef.current = false;
      return;
    }

    const urlRoomId = readRoomIdFromLocation(window.location);
    if (activeRoomId === urlRoomId) return;

    pushRoomToHistory(activeRoomId);
  }, [activeRoomId]);

  useEffect(() => {
    if (!client || !activeRoomId) return;
    if (knownRoomIds.length === 0) return;
    if (knownRoomIds.includes(activeRoomId)) return;
    if (client.getRoom(activeRoomId)) return;

    setActiveRoomId(null);
  }, [activeRoomId, client, knownRoomIds, setActiveRoomId]);
}
