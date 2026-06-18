import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { pageCrossfade, transition } from "@matrix-platform/ui";
import {
  buildForwardData,
  canPinMessages as canPinMessagesInRoom,
  canPaginateBackwards,
  deleteMessage,
  findSpaceIdForRoom,
  getPinnedEventIds,
  loadRoomThreads,
  markReadUpToEvent,
  mxcThumbnailUrl,
  paginateBackwards,
  removeReaction,
  reorderFavourites,
  sendReaction,
  setPinnedEventIds,
  setRoomFavourite,
  listIncomingCallRoomIds,
  subscribePinnedEvents,
  togglePinnedEventId,
  type MatrixMedia,
  type MatrixMessage,
} from "@matrix-platform/matrix-core";
import { useMatrix } from "./providers/MatrixContext";
import { useChatNavigation } from "./useChatNavigation";
import { Composer, type ComposerHandle } from "../features/composer/Composer";
import { useComposerMode } from "../features/composer/useComposerMode";
import { ForwardModal } from "../features/forward/ForwardModal";
import { Lightbox } from "../features/media/Lightbox";
import {
  MessageContextMenu,
  type MessageAction,
} from "../features/message-actions/MessageContextMenu";
import { RoomList, type RoomListHandle } from "../features/room-list/RoomList";
import { useRoomGroups } from "../features/room-list/useRoomGroups";
import { useRoomListLayout } from "../features/room-list/useRoomListLayout";
import { RoomRightPanel } from "../features/room-settings/RoomRightPanel";
import { RoomSettingsModal } from "../features/room-settings/RoomSettingsModal";
import { useRoomSettings } from "../features/room-settings/useRoomSettings";
import { CreateModals } from "../features/spaces/CreateModals";
import { SpaceRail } from "../features/spaces/SpaceRail";
import { useRoomCreation } from "../features/spaces/useRoomCreation";
import { useSpaceNavigation } from "../features/spaces/useSpaceNavigation";
import { EmptyState } from "../features/timeline/EmptyState";
import { GlobalThreadsPanel } from "../features/threads/GlobalThreadsPanel";
import { ThreadPanel } from "../features/threads/ThreadPanel";
import { ThreadsListPanel } from "../features/threads/ThreadsListPanel";
import { ChatMainHeader } from "../features/timeline/ChatMainHeader";
import { PinnedBar } from "../features/timeline/PinnedBar";
import { Timeline } from "../features/timeline/Timeline";
import { useFirstUnread } from "../features/timeline/useFirstUnread";
import { usePinnedMessages } from "../features/timeline/usePinnedMessages";
import {
  usePreloadTimelineMessages,
  useTimelineMessages,
} from "../features/timeline/useTimelineMessages";
import { formatTypingLabel, useTyping } from "../features/timeline/useTyping";
import { useAccountSettings } from "../features/account/useAccountSettings";
import { useEncryption } from "../features/encryption/useEncryption";
import { CallPanel } from "../features/calls/CallPanel";
import { CALLS_ENABLED } from "../features/calls/callsEnabled";
import { useIncomingCall } from "../features/calls/useIncomingCall";
import { useRoomCall } from "../features/calls/useRoomCall";
import { SettingsPage } from "../features/settings/SettingsModal";
import { usePreferences } from "../features/settings/usePreferences";
import { useChatUrl } from "./useChatUrl";
import { useChatShellKeyboard } from "./useChatShellKeyboard";
import { useChatShellState } from "./useChatShellState";
import { useDeepLink } from "./useDeepLink";
import "./chat-shell.css";

const RIGHT_PANEL_WIDTH = 320;

export function ChatShell() {
  const { client, logout } = useMatrix();
  const { preferences, setPreference } = usePreferences();
  const roomGroups = useRoomGroups(client);
  const shell = useChatShellState(preferences);
  const {
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
  } = shell;
  const roomListLayout = useRoomListLayout();
  const composerRef = useRef<ComposerHandle | null>(null);
  const roomListRef = useRef<RoomListHandle | null>(null);

  const allRooms = useMemo(
    () => [
      ...roomGroups.favourites,
      ...roomGroups.channels,
      ...roomGroups.dms,
    ],
    [roomGroups.channels, roomGroups.dms, roomGroups.favourites],
  );
  const allRoomIds = useMemo(() => allRooms.map((room) => room.id), [allRooms]);
  const dmRoomIds = useMemo(() => roomGroups.dms.map((room) => room.id), [roomGroups.dms]);
  useChatUrl({
    client,
    activeRoomId,
    setActiveRoomId,
    activeSpaceId,
    setActiveSpaceId,
    sidebarView,
    setSidebarView,
    dmRoomIds,
    spaces: roomGroups.spaces,
    knownRoomIds: allRoomIds,
  });
  usePreloadTimelineMessages(client, allRoomIds);
  const spaceNavigation = useSpaceNavigation(roomGroups, activeSpaceId, sidebarView, setActiveSpaceId);
  const roomSettings = useRoomSettings({ client });
  const accountSettings = useAccountSettings({ client });
  const encryption = useEncryption({ client });

  const activeRoom = useMemo(() => {
    return allRooms.find((room) => room.id === activeRoomId) ?? null;
  }, [activeRoomId, allRooms]);
  const composerMode = useComposerMode(activeRoom?.id);
  const clearComposerMode = composerMode.clearComposerMode;
  const focusPinnedMessage = useCallback((messageId: string) => {
    // Scope to the main chat so we don't grab the same message rendered inside
    // the thread panel.
    const node = document.querySelector<HTMLElement>(
      `.chat-main [data-mid="${CSS.escape(messageId)}"]`,
    );
    if (!node) return;

    node.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightMessageId(messageId);
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => setHighlightMessageId(null), 1700);
  }, [highlightTimerRef, setHighlightMessageId]);
  const clearMessageMenu = useCallback(() => setMessageMenu(null), [setMessageMenu]);
  const resolveSpaceForRoom = useCallback(
    (roomId: string) => findSpaceIdForRoom(roomGroups.spaces, roomId),
    [roomGroups.spaces],
  );
  const resolveIsDmRoom = useCallback(
    (roomId: string) => dmRoomIds.includes(roomId),
    [dmRoomIds],
  );
  const chatNavigation = useChatNavigation({
    client,
    activeRoomId,
    forwarding,
    spaceNavigation,
    setActiveRoomId,
    setActiveSpaceId,
    setSidebarView,
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
    startForward: composerMode.startForward,
    focusPinnedMessage,
    resolveSpaceForRoom,
    resolveIsDmRoom,
  });
  useDeepLink(client, chatNavigation.selectRoom);
  useChatShellKeyboard({ state: shell, activeRoom, chatNavigation, composerRef, roomListRef });
  const creation = useRoomCreation({
    client,
    activeSpaceId: spaceNavigation.effectiveActiveSpaceId,
    onOpenRoom: chatNavigation.selectRoom,
    onOpenSpace: setActiveSpaceId,
  });
  const messages = useTimelineMessages(client, activeRoomId);
  const pinnedMessages = usePinnedMessages(client, activeRoomId, optimisticPinnedIds);
  const rawTypingLabel = formatTypingLabel(useTyping(client, activeRoomId));
  const typingLabel = preferences.showTypingIndicator ? rawTypingLabel : null;
  const incomingCallRoomIds = useMemo(
    () => (client ? listIncomingCallRoomIds(client) : []),
    [client, allRooms],
  );
  const roomCall = useRoomCall(CALLS_ENABLED ? client : null, CALLS_ENABLED ? activeRoomId : null);
  const { incoming: incomingCall, dismiss: dismissIncomingCall, decline: declineIncomingCall } = useIncomingCall(
    CALLS_ENABLED ? client : null,
    incomingCallRoomIds,
    roomCall.status,
  );
  const callActive = roomCall.status !== "idle";
  // The call's own room — independent of which chat is open — so the panel
  // persists and shows the right peer when navigating away from the call.
  const callRoom = useMemo(
    () => allRooms.find((room) => room.id === roomCall.callRoomId) ?? null,
    [allRooms, roomCall.callRoomId],
  );
  const callPeerName = callRoom?.name ?? "";
  const incomingRoom = useMemo(
    () => (incomingCall ? allRooms.find((room) => room.id === incomingCall.roomId) ?? null : null),
    [allRooms, incomingCall],
  );
  const callUiPeer = useMemo(() => {
    if (roomCall.status !== "idle" && callRoom) {
      return { name: callPeerName, avatarUrl: callRoom.avatarUrl, id: callRoom.id };
    }
    if (incomingCall) {
      return {
        name: incomingCall.callerName,
        avatarUrl: incomingRoom?.avatarUrl,
        id: incomingCall.roomId,
      };
    }
    return { name: "", avatarUrl: undefined, id: undefined };
  }, [callPeerName, callRoom, incomingCall, incomingRoom, roomCall.status]);
  const handleStartCall = useCallback(() => {
    void roomCall.start({ ring: true, intent: "audio" });
  }, [roomCall]);
  const handleStartVideoCall = useCallback(() => {
    void roomCall.start({ ring: true, intent: "video" });
  }, [roomCall]);
  const handleAnswerCall = useCallback(() => {
    if (!incomingCall) return;
    const { roomId, callIntent } = incomingCall;
    dismissIncomingCall();
    if (activeRoomId !== roomId) {
      chatNavigation.selectRoom(roomId);
    }
    void roomCall.start({ ring: false, roomId, intent: callIntent });
  }, [activeRoomId, chatNavigation, dismissIncomingCall, incomingCall, roomCall]);
  const handleDeclineCall = useCallback(() => {
    if (!incomingCall) return;
    void declineIncomingCall(incomingCall);
  }, [declineIncomingCall, incomingCall]);
  const hasOlder = useMemo(
    () => Boolean(client && activeRoomId && canPaginateBackwards(client, activeRoomId)),
    // messages.length is intentionally a dep: re-evaluate after each page loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, activeRoomId, messages.length],
  );
  const loadOlder = useCallback(async (): Promise<boolean> => {
    if (!client || !activeRoomId) return false;
    return paginateBackwards(client, activeRoomId, 120);
  }, [client, activeRoomId]);
  const activeMatrixRoom = useMemo(
    () => (client && activeRoomId ? client.getRoom(activeRoomId) : null),
    [activeRoomId, client],
  );
  const roomMembers = useMemo(() => {
    if (!client || !activeMatrixRoom) return [];
    const me = client.getUserId();

    return activeMatrixRoom
      .getMembers()
      .filter((member) => member.membership === "join" || member.membership === "invite")
      .map((member) => ({
        id: member.userId,
        name: member.name || member.userId,
        userId: member.userId,
        avatarUrl: memberAvatarUrl(client, member),
        color: activeRoom ? activeRoom.color : "#8b7f99",
        me: member.userId === me,
      }))
      .sort((left, right) => Number(right.me) - Number(left.me) || left.name.localeCompare(right.name));
  }, [activeMatrixRoom, activeRoom, client]);
  const roomMedia = useMemo(
    () =>
      messages
        .filter((message): message is MatrixMessage & { media: MatrixMedia } => Boolean(message.media))
        .map((message) => ({
          id: message.id,
          media: message.media,
          author: message.own ? "Вы" : message.author,
          time: message.time,
        })),
    [messages],
  );
  const canPinMessages = canPinMessagesInRoom(client, activeRoomId);

  const openMessageMenu = (
    message: MatrixMessage,
    x: number,
    y: number,
    source: "main" | "thread" = "main",
  ) => {
    setMessageMenu({ message, x, y, source });
  };

  const handleMessageAction = (action: MessageAction, message: MatrixMessage) => {
    if (!client || !activeRoomId) return;
    const inThread = messageMenu?.source === "thread";

    // Reply / edit inside the thread stay in the thread composer.
    if (action === "reply") {
      if (inThread) setThreadReplyTo(composerMode.messageReference(message));
      else composerMode.startReply(message);
    }
    if (action === "thread") openThread(message.id);
    if (action === "edit") {
      if (inThread) setThreadEditing(composerMode.messageReference(message));
      else composerMode.startEdit(message);
    }
    if (action === "copy" && message.text) void navigator.clipboard.writeText(message.text);
    if (action === "forward") {
      setForwarding([buildForwardData(client, activeRoomId, message)]);
    }
    if (action === "pin") {
      void togglePinnedMessage(message);
    }
    if (action === "delete" && window.confirm("Удалить сообщение?")) {
      void deleteMessage(client, activeRoomId, message.id);
    }
  };

  const togglePinnedMessage = async (message: MatrixMessage) => {
    if (!client || !activeRoomId) return;

    const currentPinned = getPinnedEventIds(client, activeRoomId, optimisticPinnedIds);
    const nextPinned = togglePinnedEventId(currentPinned, message.id);

    setOptimisticPinnedIds(nextPinned);

    try {
      await setPinnedEventIds(client, activeRoomId, nextPinned);
    } catch (error) {
      setOptimisticPinnedIds(currentPinned);
      console.error("[pin-message]", error);
      window.alert("Не удалось изменить закреплённые сообщения. Проверьте права в комнате.");
    }
  };

  const openThread = (rootId: string) => {
    setThreadEditing(null);
    setThreadReplyTo(null);
    setActiveThreadRootId(rootId);
    // Highlight + scroll to the root message in the main chat.
    window.setTimeout(() => focusPinnedMessage(rootId), 90);
  };

  const cyclePinnedMessage = () => {
    if (pinnedMessages.length === 0) return;
    const index = pinnedIndex % pinnedMessages.length;
    const current = pinnedMessages[index];
    if (!current?.id) return;

    focusPinnedMessage(current.id);
    setPinnedIndex((index + 1) % pinnedMessages.length);
  };

  const toggleReaction = (message: MatrixMessage, key: string) => {
    if (!client || !activeRoomId) return;
    const existing = message.reactions.find((reaction) => reaction.key === key && reaction.mine);

    if (existing?.myEventId) {
      void removeReaction(client, activeRoomId, existing.myEventId);
    } else {
      void sendReaction(client, activeRoomId, message.id, key);
    }
  };

  const toggleFavouriteRoom = (roomId: string) => {
    if (!client) return;
    const room = allRooms.find((item) => item.id === roomId);
    if (!room) return;

    void setRoomFavourite(client, roomId, !room.favourite);
  };

  const reorderFavouriteRooms = (rooms: typeof roomGroups.favourites) => {
    if (!client) return;
    if (favouritePersistTimerRef.current) {
      window.clearTimeout(favouritePersistTimerRef.current);
    }
    favouritePersistTimerRef.current = window.setTimeout(() => {
      void reorderFavourites(client, rooms.map((room) => room.id));
    }, 180);
  };

  // Once the real m.room.pinned_events state lands (our own echo or another
  // member's change), drop the optimistic override so live state wins again.
  useEffect(() => {
    if (!client || !activeRoomId) return;

    return subscribePinnedEvents(client, activeRoomId, () => setOptimisticPinnedIds(null));
  }, [client, activeRoomId]);

  // First unread message for the open room — drives the "new messages" divider
  // and opening the room scrolled to it. Frozen while the room stays open.
  const firstUnreadId = useFirstUnread(client, activeRoomId, messages);

  // Read-on-visible: the Timeline reports the latest message that actually
  // scrolled into view (after a short dwell), and we advance the read receipt to
  // it. Opening a room no longer marks it read by itself.
  const handleReadUpTo = useCallback(
    (messageId: string) => {
      if (!client || !activeRoomId) return;
      if (document.visibilityState !== "visible") return;
      void markReadUpToEvent(client, activeRoomId, messageId);
    },
    [client, activeRoomId],
  );

  // Load historical threads when a room opens so thread chips populate in the
  // timeline (threads outside the initial sync window aren't known otherwise).
  // Defer it so the first room paint wins over the background network request.
  useEffect(() => {
    if (!client || !activeRoomId) return;
    const timer = window.setTimeout(() => {
      void loadRoomThreads(client, activeRoomId);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [client, activeRoomId]);

  const showSettings = accountSettings.open && accountSettings.profile;

  return (
    <div className="app-views">
      {CALLS_ENABLED && (roomCall.status !== "idle" || incomingCall) && (
        <CallPanel
          key={roomCall.callRoomId ?? incomingCall?.roomId ?? "call"}
          call={roomCall}
          incoming={incomingCall}
          onAnswer={handleAnswerCall}
          onDecline={handleDeclineCall}
          peerName={callUiPeer.name}
          peerAvatarUrl={callUiPeer.avatarUrl}
          peerId={callUiPeer.id}
        />
      )}
      <AnimatePresence initial={false}>
        {!showSettings && (
          <motion.div
            key="chat-shell"
            className="app-views__layer app-views__layer--chat"
            variants={pageCrossfade}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <div className="chat-shell">
      <SpaceRail
        spaces={spaceNavigation.topLevelSpaces}
        spaceUnreads={spaceNavigation.topLevelSpaceUnreads}
        spaceMentions={spaceNavigation.topLevelSpaceMentions}
        dmUnreads={spaceNavigation.dmUnreads}
        dmMentions={spaceNavigation.dmMentions}
        sidebarView={sidebarView}
        activeSpaceId={spaceNavigation.railActiveSpaceId}
        onSelectHome={() => {
          setSidebarView("home");
          setActiveSpaceId(null);
        }}
        onSelectDms={() => {
          setSidebarView("dms");
          setActiveSpaceId(null);
        }}
        onSelectSpace={(spaceId) => {
          setSidebarView("space");
          setActiveSpaceId(spaceId);
        }}
        onCreateSpace={creation.openCreateSpace}
        onOpenAllThreads={() => setShowAllThreads(true)}
        onOpenSettings={accountSettings.openSettings}
        onLogout={() => void logout()}
      />

      <div
        className={`chat-shell__room-list${roomListLayout.resizing ? " is-resizing" : ""}`}
        style={{
          width: roomListLayout.width,
          minWidth: roomListLayout.width,
          flexBasis: roomListLayout.width,
        }}
      >
        <RoomList
          ref={roomListRef}
          favourites={spaceNavigation.visibleRoomGroups.favourites}
          channels={spaceNavigation.visibleRoomGroups.channels}
          dms={spaceNavigation.visibleRoomGroups.dms}
          activeRoomId={activeRoomId}
          collapsed={roomListLayout.collapsed}
          sidebarView={sidebarView}
          activeSpaceId={spaceNavigation.effectiveActiveSpaceId}
          activeSpace={spaceNavigation.activeSpace}
          subspaces={spaceNavigation.subspaces}
          parentSpaceName={spaceNavigation.parentSpace?.name ?? null}
          onBack={() => spaceNavigation.parentSpace && setActiveSpaceId(spaceNavigation.parentSpace.id)}
          onSelectSpace={(spaceId) => {
            setSidebarView("space");
            setActiveSpaceId(spaceId);
          }}
          onToggleCollapsed={roomListLayout.toggleCollapse}
          onSelectRoom={chatNavigation.selectRoom}
          onToggleFavourite={toggleFavouriteRoom}
          onReorderFavourites={reorderFavouriteRooms}
          onCreateChannel={creation.openCreateChannel}
          onCreateDm={creation.openCreateDm}
          onStartDmWithUser={(userId) => creation.openDirectChatWithUser(userId)}
          onCreateSubspace={creation.openCreateSubspace}
          onLeaveSpace={() => void chatNavigation.leaveActiveSpace()}
          onOpenSettings={roomSettings.openSettings}
          onLeaveRoom={(roomId) => void chatNavigation.leaveRoom(roomId)}
        />
        <div
          className={`chat-shell__room-list-resizer${roomListLayout.resizing ? " is-active" : ""}`}
          onPointerDown={roomListLayout.startResize}
        />
      </div>

      <main className={`chat-main${activeRoom ? "" : " is-empty"}`}>
        {activeRoom ? (
          <>
            <ChatMainHeader
              room={activeRoom}
              typingLabel={typingLabel}
              view={chatView}
              onToggleView={() => {
                const next = chatView === "bubbles" ? "flat" : "bubbles";
                setChatView(next);
                setPreference("defaultChatView", next);
              }}
              threadsActive={showThreadsList}
              onToggleThreads={() => setShowThreadsList((value) => !value)}
              infoActive={showRightPanel}
              onToggleInfo={() => setShowRightPanel((value) => !value)}
              callsEnabled={CALLS_ENABLED}
              callActive={callActive}
              onStartCall={handleStartCall}
              onStartVideoCall={handleStartVideoCall}
            />
            <AnimatePresence initial={false}>
              {pinnedMessages.length > 0 && (() => {
                const currentIndex = pinnedMessages.length > 0 ? pinnedIndex % pinnedMessages.length : 0;
                const current = pinnedMessages[currentIndex];
                if (!current) return null;

                return (
                  <motion.button
                    type="button"
                    className="pinned-bar"
                    onClick={cyclePinnedMessage}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={transition.fast}
                  >
                    <PinnedBar pinned={pinnedMessages} currentIndex={currentIndex} current={current} />
                  </motion.button>
                );
              })()}
            </AnimatePresence>
            <Timeline
              key={activeRoom.id}
              highlightMessageId={highlightMessageId}
              messages={messages}
              onOpenImage={setLightbox}
              onOpenMessageMenu={openMessageMenu}
              onToggleReaction={toggleReaction}
              onOpenThread={openThread}
              onLoadOlder={loadOlder}
              hasOlder={hasOlder}
              room={activeRoom}
              view={chatView}
              firstUnreadId={firstUnreadId}
              onReadUpTo={handleReadUpTo}
            />
            <Composer
              ref={composerRef}
              key={composerMode.composerKey}
              roomId={activeRoom.id}
              editingMessage={composerMode.editingMessage}
              pendingForward={composerMode.pendingForward}
              replyTo={composerMode.replyTo}
              onCancelEdit={composerMode.cancelEdit}
              onCancelForward={composerMode.cancelForward}
              onCancelReply={composerMode.cancelReply}
              onSent={clearComposerMode}
            />
          </>
        ) : (
          <section className="chat-main__placeholder">
            <EmptyState />
          </section>
        )}
      </main>
      <AnimatePresence initial={false}>
        {activeRoom && showRightPanel && (
          <motion.aside
            className="right-panel"
            initial={{ width: 0 }}
            animate={{ width: RIGHT_PANEL_WIDTH }}
            exit={{ width: 0 }}
            transition={transition.slow}
          >
            <div className="right-panel__inner">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${activeRoom.id}:${rightPanelSection}`}
                  className="right-panel__content"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={transition.fast}
                >
                  <RoomRightPanel
                    room={activeRoom}
                    section={rightPanelSection}
                    onSectionChange={setRightPanelSection}
                    members={roomMembers}
                    media={roomMedia}
                    onOpenSettings={() => roomSettings.openSettings(activeRoom.id)}
                    onOpenImage={setLightbox}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      {activeRoom && showThreadsList && !activeThreadRootId && (
        <ThreadsListPanel
          roomId={activeRoom.id}
          onSelect={(rootId) => {
            setActiveThreadRootId(rootId);
            setShowThreadsList(false);
          }}
          onClose={() => setShowThreadsList(false)}
        />
      )}
      {activeRoom && activeThreadRootId && (
        <ThreadPanel
          roomId={activeRoom.id}
          room={activeRoom}
          rootId={activeThreadRootId}
          view={chatView}
          highlightMessageId={highlightMessageId}
          editing={threadEditing}
          replyTo={threadReplyTo}
          onOpenImage={setLightbox}
          onOpenMessageMenu={(message, x, y) => openMessageMenu(message, x, y, "thread")}
          onToggleReaction={toggleReaction}
          onCancelEdit={() => setThreadEditing(null)}
          onCancelReply={() => setThreadReplyTo(null)}
          onSent={() => {
            setThreadEditing(null);
            setThreadReplyTo(null);
          }}
          onClose={() => {
            setActiveThreadRootId(null);
            setThreadEditing(null);
            setThreadReplyTo(null);
          }}
        />
      )}
      {messageMenu && (
        <MessageContextMenu
          canPin={canPinMessages}
          message={messageMenu.message}
          x={messageMenu.x}
          y={messageMenu.y}
          onAction={handleMessageAction}
          onReact={toggleReaction}
          onClose={() => setMessageMenu(null)}
        />
      )}
      <AnimatePresence>
        {forwarding && (
          <ForwardModal
            rooms={allRooms}
            title={forwarding.length > 1 ? `Переслать (${forwarding.length}) в...` : "Переслать в..."}
            onClose={() => setForwarding(null)}
            onSelectRoom={chatNavigation.selectForwardRoom}
          />
        )}
      </AnimatePresence>
      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      <GlobalThreadsPanel
        open={showAllThreads}
        onSelect={chatNavigation.openThreadFromGlobal}
        onClose={() => setShowAllThreads(false)}
      />
      <CreateModals
        creation={creation}
        activeSpaceId={spaceNavigation.effectiveActiveSpaceId}
        activeSpaceName={spaceNavigation.activeSpace?.name ?? null}
      />
      <RoomSettingsModal settings={roomSettings} />
    </div>
          </motion.div>
        )}
        {showSettings && (
          <motion.div
            key="settings-page"
            className="app-views__layer app-views__layer--settings"
            variants={pageCrossfade}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <SettingsPage
              settings={accountSettings}
              encryption={encryption}
              onLogout={() => void logout()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function memberAvatarUrl(
  client: NonNullable<ReturnType<typeof useMatrix>["client"]>,
  member: ReturnType<NonNullable<ReturnType<typeof useMatrix>["client"]>["getRoom"]> extends infer T
    ? T extends { getMember(userId: string): infer M | null }
      ? M
      : never
    : never,
): string | undefined {
  const mxc = member?.getMxcAvatarUrl?.();
  return mxcThumbnailUrl(client, mxc, 48);
}
