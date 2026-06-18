import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import type { MatrixForwardData } from "@matrix-platform/matrix-core";
import type { RightPanelSection } from "../features/room-settings/RoomRightPanel";
import type { useSpaceNavigation } from "../features/spaces/useSpaceNavigation";

type SpaceNavigation = ReturnType<typeof useSpaceNavigation>;

type Options = {
  client: MatrixClient | null;
  activeRoomId: string | null;
  forwarding: MatrixForwardData[] | null;
  spaceNavigation: SpaceNavigation;
  setActiveRoomId: Dispatch<SetStateAction<string | null>>;
  setActiveSpaceId: Dispatch<SetStateAction<string | null>>;
  setRightPanelSection: Dispatch<SetStateAction<RightPanelSection>>;
  setPinnedIndex: Dispatch<SetStateAction<number>>;
  setHighlightMessageId: Dispatch<SetStateAction<string | null>>;
  setOptimisticPinnedIds: Dispatch<SetStateAction<string[] | null>>;
  setActiveThreadRootId: Dispatch<SetStateAction<string | null>>;
  setShowThreadsList: Dispatch<SetStateAction<boolean>>;
  setShowAllThreads: Dispatch<SetStateAction<boolean>>;
  setShowRightPanel: Dispatch<SetStateAction<boolean>>;
  setForwarding: Dispatch<SetStateAction<MatrixForwardData[] | null>>;
  clearMessageMenu: () => void;
  clearComposerMode: () => void;
  startForward: (items: MatrixForwardData[]) => void;
  focusPinnedMessage: (messageId: string) => void;
  resolveSpaceForRoom: (roomId: string) => string | null;
};

export function useChatNavigation({
  client,
  activeRoomId,
  forwarding,
  spaceNavigation,
  setActiveRoomId,
  setActiveSpaceId,
  setRightPanelSection,
  setPinnedIndex,
  setHighlightMessageId,
  setOptimisticPinnedIds,
  setActiveThreadRootId,
  setShowThreadsList,
  setShowAllThreads,
  setShowRightPanel,
  setForwarding,
  clearMessageMenu,
  clearComposerMode,
  startForward,
  focusPinnedMessage,
  resolveSpaceForRoom,
}: Options) {
  const resetRoomView = useCallback(() => {
    setRightPanelSection("overview");
    setPinnedIndex(0);
    setHighlightMessageId(null);
    setOptimisticPinnedIds(null);
    setActiveThreadRootId(null);
    setShowThreadsList(false);
  }, [
    setActiveThreadRootId,
    setHighlightMessageId,
    setOptimisticPinnedIds,
    setPinnedIndex,
    setRightPanelSection,
    setShowThreadsList,
  ]);

  const selectRoom = useCallback((roomId: string) => {
    setActiveRoomId(roomId);
    setActiveSpaceId(resolveSpaceForRoom(roomId));
    resetRoomView();
    clearComposerMode();
  }, [clearComposerMode, resetRoomView, resolveSpaceForRoom, setActiveRoomId, setActiveSpaceId]);

  const openThreadFromGlobal = useCallback((roomId: string, rootId: string) => {
    setActiveRoomId(roomId);
    setActiveSpaceId(resolveSpaceForRoom(roomId));
    resetRoomView();
    setShowAllThreads(false);
    clearComposerMode();
    setActiveThreadRootId(rootId);
    window.setTimeout(() => focusPinnedMessage(rootId), 220);
  }, [
    clearComposerMode,
    focusPinnedMessage,
    resetRoomView,
    resolveSpaceForRoom,
    setActiveRoomId,
    setActiveSpaceId,
    setActiveThreadRootId,
    setShowAllThreads,
  ]);

  const selectForwardRoom = useCallback((roomId: string) => {
    if (!forwarding?.length) return;
    setActiveRoomId(roomId);
    setActiveSpaceId(resolveSpaceForRoom(roomId));
    setPinnedIndex(0);
    setHighlightMessageId(null);
    setOptimisticPinnedIds(null);
    startForward(forwarding);
    setForwarding(null);
  }, [
    forwarding,
    setActiveRoomId,
    setForwarding,
    setHighlightMessageId,
    setOptimisticPinnedIds,
    setPinnedIndex,
    startForward,
    resolveSpaceForRoom,
    setActiveSpaceId,
  ]);

  const leaveRoom = useCallback(async (roomId: string) => {
    if (!client) return;
    const room = client.getRoom(roomId);
    const isSpace = room?.isSpaceRoom() ?? false;
    const label = room?.name || (isSpace ? "это пространство" : "этот чат");
    if (!window.confirm(`Покинуть «${label}»?`)) return;
    try {
      await client.leave(roomId);
      if (activeRoomId === roomId) setActiveRoomId(null);
      if (spaceNavigation.effectiveActiveSpaceId === roomId) {
        setActiveSpaceId(spaceNavigation.spaceParentId.get(roomId) ?? null);
      }
    } catch (error) {
      console.error("[leave-room]", error);
      window.alert(isSpace ? "Не удалось покинуть пространство." : "Не удалось покинуть чат.");
    }
  }, [
    activeRoomId,
    client,
    setActiveRoomId,
    setActiveSpaceId,
    spaceNavigation.effectiveActiveSpaceId,
    spaceNavigation.spaceParentId,
  ]);

  const leaveActiveSpace = useCallback(async () => {
    if (!client || !spaceNavigation.effectiveActiveSpaceId) return;
    if (!window.confirm(`Выйти из пространства «${spaceNavigation.activeSpace?.name ?? ""}»?`)) return;
    const parentId = spaceNavigation.spaceParentId.get(spaceNavigation.effectiveActiveSpaceId) ?? null;
    try {
      await client.leave(spaceNavigation.effectiveActiveSpaceId);
      setActiveSpaceId(parentId);
    } catch (error) {
      console.error("[leave-space]", error);
      window.alert("Не удалось выйти из пространства.");
    }
  }, [
    client,
    setActiveSpaceId,
    spaceNavigation.activeSpace?.name,
    spaceNavigation.effectiveActiveSpaceId,
    spaceNavigation.spaceParentId,
  ]);

  const closeActiveRoom = useCallback(() => {
    setActiveRoomId(null);
    resetRoomView();
    setShowRightPanel(false);
    clearMessageMenu();
    clearComposerMode();
  }, [
    clearComposerMode,
    clearMessageMenu,
    resetRoomView,
    setActiveRoomId,
    setShowRightPanel,
  ]);

  return useMemo(() => ({
    selectRoom,
    openThreadFromGlobal,
    selectForwardRoom,
    leaveRoom,
    leaveActiveSpace,
    closeActiveRoom,
  }), [
    closeActiveRoom,
    leaveActiveSpace,
    leaveRoom,
    openThreadFromGlobal,
    selectForwardRoom,
    selectRoom,
  ]);
}
