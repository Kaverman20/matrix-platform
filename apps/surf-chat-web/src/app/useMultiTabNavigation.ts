import { useEffect, useMemo, useRef } from "react";
import { chatUrlFromSidebar, replaceChatInHistory, type SidebarView } from "./chatUrl";
import {
  MULTI_TAB_CHANNEL,
  parseMultiTabNavMessage,
  shouldApplyRemoteNavigation,
  type MultiTabNavState,
} from "./multiTabNavigation";

type Options = {
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;
  activeSpaceId: string | null;
  setActiveSpaceId: (spaceId: string | null) => void;
  sidebarView: SidebarView;
  setSidebarView: (view: SidebarView) => void;
  onRemoteNavigate?: () => void;
};

function createTabId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tab-${Math.random().toString(36).slice(2)}`;
}

/** Mirrors sidebar navigation across open Surf Chat tabs via BroadcastChannel. */
export function useMultiTabNavigation({
  activeRoomId,
  setActiveRoomId,
  activeSpaceId,
  setActiveSpaceId,
  sidebarView,
  setSidebarView,
  onRemoteNavigate,
}: Options): void {
  const tabIdRef = useRef(createTabId());
  const applyingRemoteRef = useRef(false);
  const onRemoteNavigateRef = useRef(onRemoteNavigate);

  useEffect(() => {
    onRemoteNavigateRef.current = onRemoteNavigate;
  }, [onRemoteNavigate]);

  const currentState = useMemo<MultiTabNavState>(
    () => ({ roomId: activeRoomId, spaceId: activeSpaceId, sidebarView }),
    [activeRoomId, activeSpaceId, sidebarView],
  );
  const currentStateRef = useRef(currentState);

  useEffect(() => {
    currentStateRef.current = currentState;
  }, [currentState]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(MULTI_TAB_CHANNEL);

    channel.onmessage = (event: MessageEvent) => {
      const message = parseMultiTabNavMessage(event.data);
      if (!message) return;
      if (!shouldApplyRemoteNavigation(message, tabIdRef.current, currentStateRef.current)) return;

      applyingRemoteRef.current = true;
      replaceChatInHistory(chatUrlFromSidebar(message.roomId, message.spaceId, message.sidebarView));
      setActiveRoomId(message.roomId);
      setActiveSpaceId(message.spaceId);
      setSidebarView(message.sidebarView);
      onRemoteNavigateRef.current?.();
    };

    return () => {
      channel.close();
    };
  }, [setActiveRoomId, setActiveSpaceId, setSidebarView]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }

    const channel = new BroadcastChannel(MULTI_TAB_CHANNEL);
    channel.postMessage({
      type: "nav",
      tabId: tabIdRef.current,
      roomId: activeRoomId,
      spaceId: activeSpaceId,
      sidebarView,
    });
    channel.close();
  }, [activeRoomId, activeSpaceId, sidebarView]);
}
