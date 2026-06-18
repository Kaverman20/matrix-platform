import { useEffect, useRef } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { findSpaceIdForRoom, type MatrixSpaceSummary } from "@matrix-platform/matrix-core";
import {
  DM_VIEW,
  chatUrlFromSidebar,
  pushChatToHistory,
  readChatUrlFromLocation,
  sidebarViewFromChatUrl,
  type SidebarView,
} from "./chatUrl";

type Options = {
  client: MatrixClient | null;
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;
  activeSpaceId: string | null;
  setActiveSpaceId: (spaceId: string | null) => void;
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
  dmRoomIds: readonly string[];
  spaces: readonly MatrixSpaceSummary[];
  knownRoomIds: readonly string[];
};

/**
 * Keeps `?room=`, `?space=`, and `?view=dms` in sync with sidebar navigation.
 */
export function useChatUrl({
  client,
  activeRoomId,
  setActiveRoomId,
  activeSpaceId,
  setActiveSpaceId,
  sidebarView,
  setSidebarView,
  dmRoomIds,
  spaces,
  knownRoomIds,
}: Options): void {
  const skipUrlWriteRef = useRef(false);
  const inferredSidebarRef = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      skipUrlWriteRef.current = true;
      const url = readChatUrlFromLocation(window.location);
      setActiveRoomId(url.roomId);
      setActiveSpaceId(url.spaceId);
      setSidebarView(sidebarViewFromChatUrl(url));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setActiveRoomId, setActiveSpaceId, setSidebarView]);

  useEffect(() => {
    if (skipUrlWriteRef.current) {
      skipUrlWriteRef.current = false;
      return;
    }

    const next = chatUrlFromSidebar(activeRoomId, activeSpaceId, sidebarView);
    const url = readChatUrlFromLocation(window.location);
    if (
      activeRoomId === url.roomId &&
      next.spaceId === url.spaceId &&
      next.view === url.view
    ) {
      return;
    }

    pushChatToHistory(next);
  }, [activeRoomId, activeSpaceId, sidebarView]);

  useEffect(() => {
    if (!client || !activeRoomId) return;
    if (knownRoomIds.length === 0) return;
    if (knownRoomIds.includes(activeRoomId)) return;
    if (client.getRoom(activeRoomId)) return;

    setActiveRoomId(null);
  }, [activeRoomId, client, knownRoomIds, setActiveRoomId]);

  useEffect(() => {
    if (!client || sidebarView !== "space" || !activeSpaceId) return;
    if (spaces.length === 0) return;
    if (spaces.some((space) => space.id === activeSpaceId)) return;

    setActiveSpaceId(null);
    setSidebarView("home");
  }, [activeSpaceId, client, setActiveSpaceId, setSidebarView, sidebarView, spaces]);

  // Legacy links with only ?room= — infer sidebar context once.
  useEffect(() => {
    if (inferredSidebarRef.current) return;
    if (!activeRoomId) return;

    const url = readChatUrlFromLocation(window.location);
    if (url.view === DM_VIEW || url.spaceId) {
      inferredSidebarRef.current = true;
      return;
    }

    if (dmRoomIds.includes(activeRoomId)) {
      setSidebarView("dms");
      setActiveSpaceId(null);
    } else if (spaces.length > 0) {
      const inferred = findSpaceIdForRoom(spaces, activeRoomId);
      if (inferred) {
        setActiveSpaceId(inferred);
        setSidebarView("space");
      }
    }

    inferredSidebarRef.current = true;
  }, [
    activeRoomId,
    dmRoomIds,
    setActiveSpaceId,
    setSidebarView,
    spaces,
  ]);
}
