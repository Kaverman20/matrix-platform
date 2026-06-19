import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pageCrossfade, transition } from "@matrix-platform/ui";
import {
  buildForwardData,
  buildForwardDataList,
  buildMessageDeepLink,
  canPinMessages as canPinMessagesInRoom,
  canKickMember,
  canPaginateBackwards,
  deleteMessage,
  deleteMessages,
  findSpaceIdForRoom,
  getMessageEditHistory,
  getMessageReaders,
  getPinnedEventIds,
  getRoomMemberPermissions,
  inviteUser,
  kickUser,
  loadRoomThreads,
  markReadUpToEvent,
  mxcThumbnailUrl,
  paginateBackwards,
  paginateToEvent,
  removeReaction,
  reorderFavourites,
  sendPollResponse,
  sendReaction,
  setPinnedEventIds,
  setRoomFavourite,
  listIncomingCallRoomIds,
  subscribePinnedEvents,
  togglePinnedEventId,
  type MatrixMedia,
  type MatrixMessage,
  type MessageEditEntry,
  type MessageReader,
} from "@matrix-platform/matrix-core";
import { useMatrix } from "./providers/MatrixContext";
import { useChatNavigation } from "./useChatNavigation";
import { Composer, type ComposerHandle } from "../features/composer/Composer";
import { useComposerMode } from "../features/composer/useComposerMode";
import { GlobalSearchModal } from "../features/search/GlobalSearchModal";
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
import { RoomTimelineSearch } from "../features/timeline/RoomTimelineSearch";
import { Timeline } from "../features/timeline/Timeline";
import { EditHistoryModal } from "../features/timeline/EditHistoryModal";
import { ReadReceiptsPopover } from "../features/timeline/ReadReceiptsPopover";
import { useFirstUnread } from "../features/timeline/useFirstUnread";
import { usePinnedMessages } from "../features/timeline/usePinnedMessages";
import { useRoomTimelineSearch } from "../features/timeline/useRoomTimelineSearch";
import { SelectionToolbar } from "../features/selection/SelectionToolbar";
import { useMessageSelection } from "../features/selection/useMessageSelection";
import "../features/selection/selection-toolbar.css";
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
import { useMultiTabNavigation } from "./useMultiTabNavigation";
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
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

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

  const resetTransientPanels = useCallback(() => {
    setActiveThreadRootId(null);
    setShowThreadsList(false);
    setShowAllThreads(false);
    setMessageMenu(null);
    setForwarding(null);
    setLightbox(null);
    clearComposerMode();
  }, [clearComposerMode, setActiveThreadRootId, setForwarding, setLightbox, setMessageMenu, setShowAllThreads, setShowThreadsList]);

  useMultiTabNavigation({
    activeRoomId,
    setActiveRoomId,
    activeSpaceId,
    setActiveSpaceId,
    sidebarView,
    setSidebarView,
    onRemoteNavigate: resetTransientPanels,
  });

  const focusMessage = useCallback((messageId: string, scope = ".chat-main") => {
    const node = document.querySelector<HTMLElement>(
      `${scope} [data-mid="${CSS.escape(messageId)}"]`,
    );
    if (!node) return false;

    node.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightMessageId(messageId);
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => setHighlightMessageId(null), 1700);
    return true;
  }, [highlightTimerRef, setHighlightMessageId]);

  const focusMessageWithPagination = useCallback(async (messageId: string, roomId?: string) => {
    const targetRoomId = roomId ?? activeRoomId;
    if (!client || !targetRoomId) return;

    if (focusMessage(messageId)) return;

    const found = await paginateToEvent(client, targetRoomId, messageId);
    if (!found) return;

    const tryScroll = (attempt = 0) => {
      if (focusMessage(messageId)) return;
      if (attempt < 12) {
        window.setTimeout(() => tryScroll(attempt + 1), 50);
      }
    };
    tryScroll();
  }, [activeRoomId, client, focusMessage]);
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
    focusPinnedMessage: focusMessageWithPagination,
    resolveSpaceForRoom,
    resolveIsDmRoom,
  });
  useDeepLink(client, chatNavigation.selectRoom, focusMessageWithPagination);
  const creation = useRoomCreation({
    client,
    activeSpaceId: spaceNavigation.effectiveActiveSpaceId,
    onOpenRoom: chatNavigation.selectRoom,
    onOpenSpace: setActiveSpaceId,
  });
  const openGlobalSearchMessage = useCallback((roomId: string, messageId: string) => {
    setGlobalSearchOpen(false);
    if (activeRoomId !== roomId) {
      chatNavigation.selectRoom(roomId);
    }
    const delay = activeRoomId === roomId ? 0 : 90;
    window.setTimeout(() => void focusMessageWithPagination(messageId, roomId), delay);
  }, [activeRoomId, chatNavigation, focusMessageWithPagination]);
  const messages = useTimelineMessages(client, activeRoomId);
  const selection = useMessageSelection(messages);
  const { clear: clearSelection } = selection;
  const [editHistoryEntries, setEditHistoryEntries] = useState<MessageEditEntry[] | null>(null);
  const [readReceipts, setReadReceipts] = useState<{
    readers: MessageReader[];
    anchorRect: DOMRect;
  } | null>(null);

  useEffect(() => {
    clearSelection();
  }, [activeRoomId, clearSelection]);

  useEffect(() => {
    if (!selection.active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selection.active, clearSelection]);

  const timelineSearch = useRoomTimelineSearch({
    client,
    roomId: activeRoomId,
    messages,
  });
  useEffect(() => {
    if (!timelineSearch.open || !timelineSearch.currentHitId) return;
    void focusMessageWithPagination(timelineSearch.currentHitId);
  }, [timelineSearch.currentHitId, timelineSearch.open, focusMessageWithPagination]);
  useChatShellKeyboard({
    state: shell,
    activeRoom,
    chatNavigation,
    composerRef,
    roomListRef,
    globalSearchOpen,
    onToggleGlobalSearch: () => setGlobalSearchOpen((value) => !value),
    onOpenTimelineSearch: () => timelineSearch.setOpen(true),
  });
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
  const roomMemberPermissions = useMemo(
    () => (client && activeRoomId ? getRoomMemberPermissions(client, activeRoomId) : { canInvite: false, canKick: false, myPowerLevel: 0 }),
    [activeRoomId, client],
  );
  const composerMembers = useMemo(
    () => roomMembers.map((member) => ({ userId: member.userId, name: member.name })),
    [roomMembers],
  );
  const pinnedPreviews = useMemo(
    () => pinnedMessages.map((message) => ({
      id: message.id,
      author: message.author ?? "Сообщение",
      text: message.text,
    })),
    [pinnedMessages],
  );
  const canKickRoomMember = useCallback(
    (userId: string) => Boolean(client && activeRoomId && canKickMember(client, activeRoomId, userId)),
    [activeRoomId, client],
  );
  const handleInviteUser = useCallback(async (userId: string) => {
    if (!client || !activeRoomId) return;
    try {
      await inviteUser(client, activeRoomId, userId);
    } catch (error) {
      console.error("[invite-user]", error);
      window.alert("Не удалось пригласить пользователя.");
    }
  }, [activeRoomId, client]);
  const handleKickMember = useCallback(async (userId: string) => {
    if (!client || !activeRoomId) return;
    try {
      await kickUser(client, activeRoomId, userId);
    } catch (error) {
      console.error("[kick-user]", error);
      window.alert("Не удалось исключить участника.");
    }
  }, [activeRoomId, client]);

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
    if (action === "link") {
      const url = buildMessageDeepLink(window.location.origin, activeRoomId, message.id);
      void navigator.clipboard.writeText(url);
    }
    if (action === "forward") {
      setForwarding([buildForwardData(client, activeRoomId, message)]);
    }
    if (action === "select") {
      selection.enter();
      selection.toggle(message.id);
    }
    if (action === "history") {
      setEditHistoryEntries(getMessageEditHistory(client, activeRoomId, message.id));
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
    window.setTimeout(() => void focusMessageWithPagination(rootId), 90);
  };

  const cyclePinnedMessage = () => {
    if (pinnedMessages.length === 0) return;
    const index = pinnedIndex % pinnedMessages.length;
    const current = pinnedMessages[index];
    if (!current?.id) return;

    void focusMessageWithPagination(current.id);
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

  const handleBulkForward = () => {
    if (!client || !activeRoomId || selection.selectedMessages.length === 0) return;
    setForwarding(buildForwardDataList(client, activeRoomId, selection.selectedMessages));
    selection.clear();
  };

  const handleBulkDelete = () => {
    if (!client || !activeRoomId || selection.selectedIds.length === 0) return;
    const ownOnly = selection.selectedMessages.every((message) => message.own);
    if (!ownOnly) {
      window.alert("Можно удалить только свои сообщения.");
      return;
    }
    if (!window.confirm(`Удалить ${selection.selectedIds.length} сообщений?`)) return;
    void deleteMessages(client, activeRoomId, selection.selectedIds).then(() => selection.clear());
  };

  const handleVotePoll = (messageId: string, answerIds: string[]) => {
    if (!client || !activeRoomId) return;
    void sendPollResponse(client, activeRoomId, messageId, answerIds);
  };

  const handleShowEditHistory = (message: MatrixMessage) => {
    if (!client || !activeRoomId) return;
    setEditHistoryEntries(getMessageEditHistory(client, activeRoomId, message.id));
  };

  const handleShowReaders = (message: MatrixMessage, anchorRect: DOMRect) => {
    if (!client || !activeRoomId) return;
    setReadReceipts({
      readers: getMessageReaders(client, activeRoomId, message.id),
      anchorRect,
    });
  };

  const canBulkDelete =
    selection.selectedMessages.length > 0 &&
    selection.selectedMessages.every((message) => message.own);

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
            {timelineSearch.open && (
              <RoomTimelineSearch
                query={timelineSearch.query}
                loading={timelineSearch.loading}
                matchCount={timelineSearch.hits.length}
                matchIndex={timelineSearch.index}
                onQueryChange={timelineSearch.setQuery}
                onClose={() => timelineSearch.setOpen(false)}
                onNext={timelineSearch.next}
                onPrevious={timelineSearch.previous}
              />
            )}
            <Timeline
              key={activeRoom.id}
              highlightMessageId={
                timelineSearch.open && timelineSearch.currentHitId
                  ? timelineSearch.currentHitId
                  : highlightMessageId
              }
              messages={messages}
              onOpenImage={setLightbox}
              onOpenMessageMenu={openMessageMenu}
              onToggleReaction={toggleReaction}
              onOpenThread={openThread}
              onJumpToMessage={(messageId) => void focusMessageWithPagination(messageId)}
              onQuickReply={(message) => composerMode.startReply(message)}
              onQuickReact={toggleReaction}
              searchQuery={timelineSearch.open ? timelineSearch.query : undefined}
              selectionActive={selection.active}
              selectedIds={selection.selectedSet}
              onMessagePointerClick={(message, event) => selection.handleClick(message, event)}
              onToggleSelect={selection.toggle}
              onShowEditHistory={handleShowEditHistory}
              onShowReaders={handleShowReaders}
              onVotePoll={handleVotePoll}
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
              members={composerMembers}
              editingMessage={composerMode.editingMessage}
              pendingForward={composerMode.pendingForward}
              replyTo={composerMode.replyTo}
              onCancelEdit={composerMode.cancelEdit}
              onCancelForward={composerMode.cancelForward}
              onCancelReply={composerMode.cancelReply}
              onSent={clearComposerMode}
            />
            {selection.active && (
              <SelectionToolbar
                count={selection.selectedIds.length}
                canDelete={canBulkDelete}
                onForward={handleBulkForward}
                onDelete={handleBulkDelete}
              />
            )}
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
                    pinned={pinnedPreviews}
                    permissions={roomMemberPermissions}
                    canKickMember={canKickRoomMember}
                    onOpenSettings={() => roomSettings.openSettings(activeRoom.id)}
                    onOpenImage={setLightbox}
                    onInviteUser={handleInviteUser}
                    onKickMember={handleKickMember}
                    onJumpToPinned={(messageId) => void focusMessageWithPagination(messageId)}
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
          onJumpToMessage={(messageId) => focusMessage(messageId, ".thread-panel")}
          onShowEditHistory={handleShowEditHistory}
          onShowReaders={handleShowReaders}
          onVotePoll={handleVotePoll}
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
      {editHistoryEntries && (
        <EditHistoryModal
          entries={editHistoryEntries}
          onClose={() => setEditHistoryEntries(null)}
        />
      )}
      {readReceipts && (
        <ReadReceiptsPopover
          readers={readReceipts.readers}
          anchorRect={readReceipts.anchorRect}
          onClose={() => setReadReceipts(null)}
        />
      )}
      <AnimatePresence>
        {globalSearchOpen && (
          <GlobalSearchModal
            open={globalSearchOpen}
            rooms={allRooms}
            existingDmUserIds={roomGroups.dms.map((room) => room.directUserId)}
            onClose={() => setGlobalSearchOpen(false)}
            onSelectRoom={(roomId) => {
              setGlobalSearchOpen(false);
              chatNavigation.selectRoom(roomId);
            }}
            onSelectUser={(userId) => {
              setGlobalSearchOpen(false);
              void creation.openDirectChatWithUser(userId);
            }}
            onSelectMessage={openGlobalSearchMessage}
          />
        )}
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
      <RoomSettingsModal
        settings={roomSettings}
        onLeaveRoom={
          activeRoom
            ? () => void chatNavigation.leaveRoom(activeRoom.id)
            : undefined
        }
      />
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
