import { useEffect, useRef, type RefObject } from "react";
import type { ComposerHandle } from "../features/composer/Composer";
import type { useChatNavigation } from "./useChatNavigation";
import type { ChatShellState } from "./useChatShellState";

type RoomSummary = { id: string } | null;

type Options = {
  state: ChatShellState;
  activeRoom: RoomSummary;
  chatNavigation: ReturnType<typeof useChatNavigation>;
  composerRef: RefObject<ComposerHandle | null>;
};

/** Global Escape stack: overlays close one layer at a time before leaving the room. */
export function useChatShellKeyboard({ state, activeRoom, chatNavigation, composerRef }: Options): void {
  const activeRoomRef = useRef(activeRoom);
  const forwardingRef = useRef(state.forwarding);
  const lightboxRef = useRef(state.lightbox);
  const messageMenuRef = useRef(state.messageMenu);
  const activeThreadRootIdRef = useRef(state.activeThreadRootId);
  const showThreadsListRef = useRef(state.showThreadsList);
  const showAllThreadsRef = useRef(state.showAllThreads);
  const showRightPanelRef = useRef(state.showRightPanel);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
    forwardingRef.current = state.forwarding;
    lightboxRef.current = state.lightbox;
    messageMenuRef.current = state.messageMenu;
    activeThreadRootIdRef.current = state.activeThreadRootId;
    showThreadsListRef.current = state.showThreadsList;
    showAllThreadsRef.current = state.showAllThreads;
    showRightPanelRef.current = state.showRightPanel;
  }, [
    activeRoom,
    state.activeThreadRootId,
    state.forwarding,
    state.lightbox,
    state.messageMenu,
    state.showAllThreads,
    state.showRightPanel,
    state.showThreadsList,
  ]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (forwardingRef.current) {
        event.preventDefault();
        state.setForwarding(null);
        return;
      }
      if (lightboxRef.current) {
        event.preventDefault();
        state.setLightbox(null);
        return;
      }
      if (messageMenuRef.current) {
        event.preventDefault();
        state.setMessageMenu(null);
        return;
      }
      if (showAllThreadsRef.current) {
        event.preventDefault();
        state.setShowAllThreads(false);
        return;
      }
      if (activeThreadRootIdRef.current) {
        event.preventDefault();
        state.setActiveThreadRootId(null);
        return;
      }
      if (showThreadsListRef.current) {
        event.preventDefault();
        state.setShowThreadsList(false);
        return;
      }
      if (showRightPanelRef.current) {
        event.preventDefault();
        state.setShowRightPanel(false);
        return;
      }
      if (composerRef.current?.escape()) {
        event.preventDefault();
        return;
      }
      if (activeRoomRef.current) {
        event.preventDefault();
        chatNavigation.closeActiveRoom();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatNavigation, composerRef, state]);
}
