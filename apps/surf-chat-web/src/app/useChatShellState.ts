import { useEffect, useRef, useState } from "react";
import type { MatrixForwardData, MatrixMessage, MatrixMessageReference } from "@matrix-platform/matrix-core";
import type { RightPanelSection } from "../features/room-settings/RoomRightPanel";
import type { LightboxState } from "../features/media/Lightbox";
import type { usePreferences } from "./providers/usePreferences";
import { resolveInitialActiveRoomId, resolveInitialActiveSpaceId, resolveInitialSidebarView, type SidebarView } from "./chatUrl";

export const ACTIVE_ROOM_STORAGE_KEY = "surf-chat:active-room";
export const ACTIVE_SPACE_STORAGE_KEY = "surf-chat:active-space";

export type ChatView = "flat" | "bubbles";

export type MessageMenuState = {
  message: MatrixMessage;
  x: number;
  y: number;
  source: "main" | "thread";
};

/** UI state for panels, overlays, and the active room selection. */
export function useChatShellState(preferences: ReturnType<typeof usePreferences>["preferences"]) {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() =>
    resolveInitialActiveRoomId(ACTIVE_ROOM_STORAGE_KEY),
  );
  const [forwarding, setForwarding] = useState<MatrixForwardData[] | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [chatView, setChatView] = useState<ChatView>(() => preferences.defaultChatView);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [rightPanelSection, setRightPanelSection] = useState<RightPanelSection>("overview");
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(() =>
    resolveInitialActiveSpaceId(ACTIVE_SPACE_STORAGE_KEY),
  );
  const [sidebarView, setSidebarView] = useState<SidebarView>(() => resolveInitialSidebarView());
  const [activeThreadRootId, setActiveThreadRootId] = useState<string | null>(null);
  const [showThreadsList, setShowThreadsList] = useState(false);
  const [showAllThreads, setShowAllThreads] = useState(false);
  const [threadEditing, setThreadEditing] = useState<MatrixMessageReference | null>(null);
  const [threadReplyTo, setThreadReplyTo] = useState<MatrixMessageReference | null>(null);
  const [messageMenu, setMessageMenu] = useState<MessageMenuState | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [optimisticPinnedIds, setOptimisticPinnedIds] = useState<string[] | null>(null);

  const favouritePersistTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeRoomId) {
      window.localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, activeRoomId);
    } else {
      window.localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
    }
  }, [activeRoomId]);

  useEffect(() => {
    if (activeSpaceId) {
      window.localStorage.setItem(ACTIVE_SPACE_STORAGE_KEY, activeSpaceId);
    } else {
      window.localStorage.removeItem(ACTIVE_SPACE_STORAGE_KEY);
    }
  }, [activeSpaceId]);

  useEffect(() => {
    const timer = highlightTimerRef.current;
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  return {
    activeRoomId,
    setActiveRoomId,
    forwarding,
    setForwarding,
    lightbox,
    setLightbox,
    chatView,
    setChatView,
    showRightPanel,
    setShowRightPanel,
    rightPanelSection,
    setRightPanelSection,
    activeSpaceId,
    setActiveSpaceId,
    sidebarView,
    setSidebarView,
    activeThreadRootId,
    setActiveThreadRootId,
    showThreadsList,
    setShowThreadsList,
    showAllThreads,
    setShowAllThreads,
    threadEditing,
    setThreadEditing,
    threadReplyTo,
    setThreadReplyTo,
    messageMenu,
    setMessageMenu,
    pinnedIndex,
    setPinnedIndex,
    highlightMessageId,
    setHighlightMessageId,
    optimisticPinnedIds,
    setOptimisticPinnedIds,
    favouritePersistTimerRef,
    highlightTimerRef,
  };
}

export type ChatShellState = ReturnType<typeof useChatShellState>;
