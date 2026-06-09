import { AnimatePresence, motion } from "framer-motion";
import { EventTimeline } from "matrix-js-sdk";
import {
  AlignLeft,
  ArrowLeft,
  Bell,
  ChevronRight,
  FileText,
  GripVertical,
  Hand,
  Hash,
  LogOut,
  MessageSquare,
  MousePointer2,
  PanelRight,
  Pin,
  Phone,
  Star,
  Users,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { transition } from "@matrix-platform/ui";
import {
  buildForwardData,
  removeReaction,
  sendReaction,
  type MatrixForwardData,
  type MatrixMedia,
  type MatrixMessage,
  type MatrixMessageReference,
} from "@matrix-platform/matrix-core";
import { useMatrix } from "./providers/MatrixContext";
import { Composer, type ComposerHandle } from "../features/composer/Composer";
import { ForwardModal } from "../features/forward/ForwardModal";
import {
  MessageContextMenu,
  type MessageAction,
} from "../features/message-actions/MessageContextMenu";
import { RoomList } from "../features/room-list/RoomList";
import { useRoomGroups } from "../features/room-list/useRoomGroups";
import { Timeline } from "../features/timeline/Timeline";
import { usePinnedMessages } from "../features/timeline/usePinnedMessages";
import { useTimelineMessages } from "../features/timeline/useTimelineMessages";
import "./chat-shell.css";

const ROOM_LIST_WIDTH = 304;
const ROOM_LIST_MAX = 440;
const ROOM_LIST_COLLAPSED_WIDTH = 84;
const ROOM_LIST_COLLAPSE_THRESHOLD = 200;
const RAIL_WIDTH = 72;
const RIGHT_PANEL_WIDTH = 320;

type RightPanelSection = "overview" | "members" | "media" | "notifications";
type ChatView = "flat" | "bubbles";

export function ChatShell() {
  const { client, logout } = useMatrix();
  const roomGroups = useRoomGroups(client);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MatrixMessageReference | null>(null);
  const [editingMessage, setEditingMessage] = useState<MatrixMessageReference | null>(null);
  const [pendingForward, setPendingForward] = useState<MatrixForwardData[] | null>(null);
  const [forwarding, setForwarding] = useState<MatrixForwardData[] | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [chatView, setChatView] = useState<ChatView>(
    () => (localStorage.getItem("surf-chat:view") as ChatView) || "flat",
  );
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [rightPanelSection, setRightPanelSection] = useState<RightPanelSection>("overview");
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [roomListCollapsed, setRoomListCollapsed] = useState(false);
  const [roomListWidth, setRoomListWidth] = useState(ROOM_LIST_WIDTH);
  const [roomListResizing, setRoomListResizing] = useState(false);
  const roomListWidthRef = useRef(roomListWidth);
  const roomListLastWidth = useRef(ROOM_LIST_WIDTH);
  const [messageMenu, setMessageMenu] = useState<{
    message: MatrixMessage;
    x: number;
    y: number;
  } | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const favouritePersistTimer = useRef<number | null>(null);
  const composerRef = useRef<ComposerHandle | null>(null);
  const highlightTimer = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem("surf-chat:view", chatView);
  }, [chatView]);

  const allRooms = useMemo(
    () => [
      ...roomGroups.favourites,
      ...roomGroups.channels,
      ...roomGroups.dms,
    ],
    [roomGroups.channels, roomGroups.dms, roomGroups.favourites],
  );
  const effectiveActiveSpaceId = useMemo(
    () => (activeSpaceId && roomGroups.spaces.some((space) => space.id === activeSpaceId) ? activeSpaceId : null),
    [activeSpaceId, roomGroups.spaces],
  );
  const activeSpace = useMemo(
    () => roomGroups.spaces.find((space) => space.id === effectiveActiveSpaceId) ?? null,
    [effectiveActiveSpaceId, roomGroups.spaces],
  );
  const activeSpaceChildSet = useMemo(
    () => (activeSpace ? new Set(activeSpace.childIds) : null),
    [activeSpace],
  );
  const visibleRoomGroups = useMemo(
    () => ({
      favourites: roomGroups.favourites.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
      channels: roomGroups.channels.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
      dms: roomGroups.dms.filter((room) => !activeSpaceChildSet || activeSpaceChildSet.has(room.id)),
    }),
    [roomGroups.channels, roomGroups.dms, roomGroups.favourites, activeSpaceChildSet],
  );

  const activeRoom = useMemo(() => {
    return allRooms.find((room) => room.id === activeRoomId) ?? null;
  }, [activeRoomId, allRooms]);
  const messages = useTimelineMessages(client, activeRoomId);
  const pinnedMessages = usePinnedMessages(client, activeRoomId);
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

  const messageReference = (message: MatrixMessage): MatrixMessageReference => ({
    id: message.id,
    sender: message.sender,
    author: message.own ? "Вы" : message.author,
    text: message.text,
  });

  const startReply = (message: MatrixMessage) => {
    setEditingMessage(null);
    setPendingForward(null);
    setReplyTo(messageReference(message));
  };

  const startEdit = (message: MatrixMessage) => {
    setReplyTo(null);
    setPendingForward(null);
    setEditingMessage(messageReference(message));
  };

  const clearComposerMode = () => {
    setReplyTo(null);
    setEditingMessage(null);
    setPendingForward(null);
  };

  const selectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setRightPanelSection("overview");
    setPinnedIndex(0);
    setHighlightMessageId(null);
    clearComposerMode();
  };

  const composerKey = [
    activeRoom?.id ?? "none",
    editingMessage
      ? `edit:${editingMessage.id}`
      : pendingForward
        ? `forward:${pendingForward.map((item) => item.sender + item.preview).join("|")}`
        : replyTo
          ? `reply:${replyTo.id}`
          : "plain",
  ].join(":");

  const openMessageMenu = (message: MatrixMessage, x: number, y: number) => {
    setMessageMenu({ message, x, y });
  };

  const handleMessageAction = (action: MessageAction, message: MatrixMessage) => {
    if (!client || !activeRoomId) return;

    if (action === "reply") startReply(message);
    if (action === "edit") startEdit(message);
    if (action === "copy" && message.text) void navigator.clipboard.writeText(message.text);
    if (action === "forward") {
      setForwarding([buildForwardData(client, activeRoomId, message)]);
    }
    if (action === "pin") {
      void togglePinnedMessage(message);
    }
    if (action === "delete" && window.confirm("Удалить сообщение?")) {
      void client.redactEvent(activeRoomId, message.id);
    }
  };

  const togglePinnedMessage = async (message: MatrixMessage) => {
    if (!client || !activeRoomId) return;

    const room = client.getRoom(activeRoomId);
    if (!room) return;

    const currentPinned =
      (room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.pinned_events", "")
        ?.getContent().pinned as string[] | undefined) ?? [];

    const nextPinned = currentPinned.includes(message.id)
      ? currentPinned.filter((id) => id !== message.id)
      : [...currentPinned, message.id];

    await client.sendStateEvent(activeRoomId, "m.room.pinned_events" as never, { pinned: nextPinned } as never, "");
  };

  const focusPinnedMessage = (messageId: string) => {
    const node = document.querySelector<HTMLElement>(`[data-mid="${CSS.escape(messageId)}"]`);
    if (!node) return;

    node.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightMessageId(messageId);
    if (highlightTimer.current) {
      window.clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = window.setTimeout(() => setHighlightMessageId(null), 1700);
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

  const selectForwardRoom = (roomId: string) => {
    if (!forwarding?.length) return;
    setActiveRoomId(roomId);
    setPinnedIndex(0);
    setHighlightMessageId(null);
    setPendingForward(forwarding);
    setReplyTo(null);
    setEditingMessage(null);
    setForwarding(null);
  };

  const toggleRoomListCollapse = () => {
    if (roomListCollapsed) {
      setRoomListCollapsed(false);
      setRoomListWidth(roomListLastWidth.current);
      roomListWidthRef.current = roomListLastWidth.current;
    } else {
      roomListLastWidth.current = roomListWidth;
      setRoomListCollapsed(true);
      setRoomListWidth(ROOM_LIST_COLLAPSED_WIDTH);
      roomListWidthRef.current = ROOM_LIST_COLLAPSED_WIDTH;
    }
  };

  const startRoomListResize = (event: React.PointerEvent) => {
    event.preventDefault();
    setRoomListResizing(true);

    const onMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(
        ROOM_LIST_MAX,
        Math.max(ROOM_LIST_COLLAPSED_WIDTH, moveEvent.clientX - RAIL_WIDTH),
      );
      roomListWidthRef.current = nextWidth;
      setRoomListWidth(nextWidth);
      setRoomListCollapsed(nextWidth < ROOM_LIST_COLLAPSE_THRESHOLD);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setRoomListResizing(false);

      const nextWidth = roomListWidthRef.current;
      if (nextWidth < ROOM_LIST_COLLAPSE_THRESHOLD) {
        setRoomListWidth(ROOM_LIST_COLLAPSED_WIDTH);
        roomListWidthRef.current = ROOM_LIST_COLLAPSED_WIDTH;
        setRoomListCollapsed(true);
      } else {
        roomListLastWidth.current = nextWidth;
        setRoomListCollapsed(false);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const toggleFavouriteRoom = (roomId: string) => {
    if (!client) return;
    const room = allRooms.find((item) => item.id === roomId);
    if (!room) return;

    if (room.favourite) {
      void client.deleteRoomTag(roomId, "m.favourite");
    } else {
      void client.setRoomTag(roomId, "m.favourite", { order: 0.5 });
    }
  };

  const reorderFavouriteRooms = (rooms: typeof roomGroups.favourites) => {
    if (!client) return;
    if (favouritePersistTimer.current) {
      window.clearTimeout(favouritePersistTimer.current);
    }
    favouritePersistTimer.current = window.setTimeout(() => {
      rooms.forEach((room, index) => {
        const order = rooms.length > 1 ? index / (rooms.length - 1) : 0;
        void client.setRoomTag(room.id, "m.favourite", { order });
      });
    }, 180);
  };

  const activeRoomRef = useRef(activeRoom);
  const forwardingRef = useRef(forwarding);
  const lightboxRef = useRef(lightbox);
  const messageMenuRef = useRef(messageMenu);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
    forwardingRef.current = forwarding;
    lightboxRef.current = lightbox;
    messageMenuRef.current = messageMenu;
  }, [activeRoom, forwarding, lightbox, messageMenu]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (forwardingRef.current) {
        event.preventDefault();
        setForwarding(null);
        return;
      }
      if (lightboxRef.current) {
        event.preventDefault();
        setLightbox(null);
        return;
      }
      if (messageMenuRef.current) {
        event.preventDefault();
        setMessageMenu(null);
        return;
      }
      if (composerRef.current?.escape()) {
        event.preventDefault();
        return;
      }
      if (activeRoomRef.current) {
        event.preventDefault();
        setActiveRoomId(null);
        setPinnedIndex(0);
        setHighlightMessageId(null);
        setRightPanelSection("overview");
        setMessageMenu(null);
        clearComposerMode();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="chat-shell">
      <nav className="space-rail">
        <button
          className={`space-rail__home${effectiveActiveSpaceId === null ? " is-active" : ""}`}
          title="Все чаты"
          onClick={() => setActiveSpaceId(null)}
        >
          {effectiveActiveSpaceId === null && <span className="space-rail__indicator" />}
          S
        </button>
        <div className="space-rail__spaces">
          {roomGroups.spaces.map((space) => (
            <button
              key={space.id}
              className={`space-rail__item${effectiveActiveSpaceId === space.id ? " is-active" : ""}`}
              style={{ background: space.color }}
              title={space.name}
              onClick={() => setActiveSpaceId(space.id)}
            >
              {effectiveActiveSpaceId === space.id && <span className="space-rail__indicator" />}
              {space.label}
            </button>
          ))}
        </div>
        <button
          className="space-rail__logout"
          title="Выйти"
          onClick={() => void logout()}
        >
          <LogOut size={18} />
        </button>
      </nav>

      <motion.div
        className="chat-shell__room-list"
        animate={{
          width: roomListWidth,
          minWidth: roomListWidth,
          flexBasis: roomListWidth,
        }}
        transition={roomListResizing ? { duration: 0 } : transition.slow}
      >
        <RoomList
          favourites={visibleRoomGroups.favourites}
          channels={visibleRoomGroups.channels}
          dms={visibleRoomGroups.dms}
          activeRoomId={activeRoomId}
          collapsed={roomListCollapsed}
          activeSpaceId={effectiveActiveSpaceId}
          onToggleCollapsed={toggleRoomListCollapse}
          onSelectRoom={selectRoom}
          onToggleFavourite={toggleFavouriteRoom}
          onReorderFavourites={reorderFavouriteRooms}
        />
        <div
          className={`chat-shell__room-list-resizer${roomListResizing ? " is-active" : ""}`}
          onPointerDown={startRoomListResize}
        />
      </motion.div>

      <main className={`chat-main${activeRoom ? "" : " is-empty"}`}>
        {activeRoom ? (
          <>
            <header className="chat-main__header">
              <div className="chat-main__title">
                {activeRoom.kind === "channel" && <Hash size={18} strokeWidth={2.5} />}
                <h1>{activeRoom.name}</h1>
              </div>
              <div className="chat-main__actions">
                <button
                  type="button"
                  className="icon-button"
                  title={chatView === "bubbles" ? "Вид: пузыри -> плоский" : "Вид: плоский -> пузыри"}
                  onClick={() => setChatView((value) => (value === "bubbles" ? "flat" : "bubbles"))}
                >
                  {chatView === "bubbles" ? <AlignLeft size={18} /> : <MessageSquare size={18} />}
                </button>
                <button type="button" className="icon-button" title="Звонок">
                  <Phone size={18} />
                </button>
                <button type="button" className="icon-button" title="Видео">
                  <Video size={18} />
                </button>
                <button
                  type="button"
                  className={`icon-button${showRightPanel ? " is-active" : ""}`}
                  title="Информация"
                  onClick={() => setShowRightPanel((value) => !value)}
                >
                  <PanelRight size={18} />
                </button>
              </div>
            </header>
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
                    {pinnedMessages.length > 1 && (
                      <div className="pinned-bar__segments">
                        {pinnedMessages.map((message, index) => (
                          <span
                            key={message.id}
                            className={`pinned-bar__segment${index === currentIndex ? " is-active" : ""}`}
                          />
                        ))}
                      </div>
                    )}
                    <Pin size={15} className="pinned-bar__icon" />
                    <div className="pinned-bar__body">
                      <span className="pinned-bar__label">
                        Закреплённое{pinnedMessages.length > 1 ? ` · ${currentIndex + 1}/${pinnedMessages.length}` : ""}
                      </span>
                      <span className="pinned-bar__text">{current.text ?? "Сообщение"}</span>
                    </div>
                  </motion.button>
                );
              })()}
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <Timeline
                key={activeRoom.id}
                highlightMessageId={highlightMessageId}
                messages={messages}
                onOpenImage={setLightbox}
                onOpenMessageMenu={openMessageMenu}
                onToggleReaction={toggleReaction}
                room={activeRoom}
                view={chatView}
              />
            </AnimatePresence>
            <Composer
              ref={composerRef}
              key={composerKey}
              roomId={activeRoom.id}
              editingMessage={editingMessage}
              pendingForward={pendingForward}
              replyTo={replyTo}
              onCancelEdit={() => setEditingMessage(null)}
              onCancelForward={() => setPendingForward(null)}
              onCancelReply={() => setReplyTo(null)}
              onSent={clearComposerMode}
            />
          </>
        ) : (
          <section className="chat-main__placeholder">
            <EmptyTips />
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
                  <div className="right-panel__avatar" style={{ background: activeRoom.color }}>
                    {activeRoom.avatarUrl ? (
                      <img
                        className="right-panel__avatar-img"
                        src={activeRoom.avatarUrl}
                        alt=""
                        onError={hideImage}
                      />
                    ) : null}
                    <span className="right-panel__avatar-fallback">
                      {activeRoom.kind === "channel" ? <Hash size={34} /> : activeRoom.name.slice(0, 1).toUpperCase()}
                    </span>
                  </div>
                  <strong className="right-panel__name">{activeRoom.name}</strong>
                  <span className="right-panel__sub">
                    {activeRoom.kind === "channel" ? "Канал" : "Личный чат"} · {membersLabel(activeRoom.memberCount)}
                  </span>
                  {activeRoom.topic && <div className="right-panel__topic">{activeRoom.topic}</div>}

                  {rightPanelSection === "overview" ? (
                    <div className="right-panel__rows">
                      <button type="button" className="right-panel__row" onClick={() => setRightPanelSection("members")}>
                        <Users size={18} />
                        <span>Участники</span>
                        <em>{roomMembers.length}</em>
                        <ChevronRight size={16} />
                      </button>
                      <button type="button" className="right-panel__row" onClick={() => setRightPanelSection("media")}>
                        <FileText size={18} />
                        <span>Файлы и медиа</span>
                        <em>{roomMedia.length}</em>
                        <ChevronRight size={16} />
                      </button>
                      <button
                        type="button"
                        className="right-panel__row"
                        onClick={() => setRightPanelSection("notifications")}
                      >
                        <Bell size={18} />
                        <span>Уведомления</span>
                        <em>{activeRoom.unread > 0 ? activeRoom.unread : "По умолчанию"}</em>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="right-panel__section-head">
                        <button
                          type="button"
                          className="right-panel__back"
                          onClick={() => setRightPanelSection("overview")}
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <strong className="right-panel__section-title">
                          {rightPanelSection === "members"
                            ? "Участники"
                            : rightPanelSection === "media"
                              ? "Файлы и медиа"
                              : "Уведомления"}
                        </strong>
                      </div>

                      {rightPanelSection === "members" ? (
                        <div className="right-panel__list">
                          {roomMembers.map((member) => (
                            <div key={member.id} className="right-panel__member">
                              <div className="right-panel__member-avatar" style={{ background: member.color }}>
                                {member.avatarUrl ? (
                                  <img
                                    className="right-panel__member-avatar-img"
                                    src={member.avatarUrl}
                                    alt=""
                                    onError={hideImage}
                                  />
                                ) : null}
                                <span className="right-panel__member-avatar-fallback">
                                  {(member.name[0] || "?").toUpperCase()}
                                </span>
                              </div>
                              <div className="right-panel__member-body">
                                <strong>{member.name}</strong>
                                <span>{member.me ? "Вы" : member.userId}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : rightPanelSection === "media" ? (
                        roomMedia.length > 0 ? (
                          <div className="right-panel__list">
                            {roomMedia.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="right-panel__media"
                                onClick={() => item.media.kind === "image" && setLightbox(item.media.url)}
                              >
                                <div className="right-panel__media-preview">
                                  {item.media.kind === "image" && item.media.thumbUrl ? (
                                    <img src={item.media.thumbUrl} alt="" />
                                  ) : (
                                    <span>{mediaKindLabel(item.media.kind)}</span>
                                  )}
                                </div>
                                <div className="right-panel__media-body">
                                  <strong>{item.media.name}</strong>
                                  <span>
                                    {item.author} · {item.time}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="right-panel__empty">
                            <FileText size={18} />
                            <span>В этой комнате пока нет файлов и медиа.</span>
                          </div>
                        )
                      ) : (
                        <div className="right-panel__cards">
                          <div className="right-panel__card">
                            <span>Режим комнаты</span>
                            <strong>По умолчанию</strong>
                          </div>
                          <div className="right-panel__card">
                            <span>Непрочитанные</span>
                            <strong>{activeRoom.unread}</strong>
                          </div>
                          <div className="right-panel__card">
                            <span>Избранное</span>
                            <strong>{activeRoom.favourite ? "Да" : "Нет"}</strong>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {messageMenu && (
          <MessageContextMenu
            message={messageMenu.message}
            x={messageMenu.x}
            y={messageMenu.y}
            onAction={handleMessageAction}
            onReact={toggleReaction}
            onClose={() => setMessageMenu(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {forwarding && (
          <ForwardModal
            rooms={allRooms}
            title={forwarding.length > 1 ? `Переслать (${forwarding.length}) в...` : "Переслать в..."}
            onClose={() => setForwarding(null)}
            onSelectRoom={selectForwardRoom}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="lightbox"
            onMouseDown={() => setLightbox(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition.fast}
          >
            <motion.img
              className="lightbox__image"
              src={lightbox}
              alt=""
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={transition.fast}
              onMouseDown={(event) => event.stopPropagation()}
            />
            <button type="button" className="lightbox__close" title="Закрыть">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function membersLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} участник`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} участника`;
  return `${count} участников`;
}

const ESC_TIP_DURATION = 2;
const VIEWS_TIMES = [0, 0.08, 0.2, 0.24, 0.26, 0.42, 0.5, 0.54, 0.56, 0.72, 0.88, 1];
const VIEWS_TRANSITION = {
  duration: 6,
  repeat: Infinity,
  times: VIEWS_TIMES,
  ease: "easeInOut" as const,
};
const SECTION_STEP = 29;
const SECTION_CYCLE_TIMES = [0, 0.08, 0.18, 0.24, 0.4, 0.46, 0.54, 0.6, 0.76, 0.82, 0.92, 1];
const SECTION_CYCLE_TRANSITION = {
  duration: 9,
  repeat: Infinity,
  times: SECTION_CYCLE_TIMES,
  ease: "easeInOut" as const,
};

const vizFav = (
  <div className="tipviz">
    <div className="tipviz__row">
      <span className="tipviz__ava" />
      <span className="tipviz__lines">
        <i />
        <i className="short" />
      </span>
      <span className="tipviz__star">
        <Star size={15} fill="currentColor" />
      </span>
    </div>
  </div>
);

const vizViews = (
  <div className="tipviz tipviz--views">
    <motion.div
      className="tipviz__view"
      animate={{
        scale: [1, 1, 1, 1.05, 1.05, 1.05, 1.05, 1, 1, 1, 1, 1],
        boxShadow: [
          "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)",
          "var(--shadow-md)", "var(--shadow-md)", "var(--shadow-md)", "var(--shadow-md)",
          "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)",
        ],
      }}
      transition={VIEWS_TRANSITION}
    >
      <AlignLeft className="tipviz__view-icon" size={12} />
      <span className="tipviz__msg" />
      <span className="tipviz__msg short" />
      <span className="tipviz__msg" />
      <em>Строки</em>
    </motion.div>
    <motion.div
      className="tipviz__view"
      animate={{
        scale: [1, 1, 1, 1, 1, 1, 1, 1.05, 1.05, 1.05, 1, 1],
        boxShadow: [
          "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)",
          "var(--shadow-sm)", "var(--shadow-sm)", "var(--shadow-sm)",
          "var(--shadow-md)", "var(--shadow-md)", "var(--shadow-md)",
          "var(--shadow-sm)", "var(--shadow-sm)",
        ],
      }}
      transition={VIEWS_TRANSITION}
    >
      <MessageSquare className="tipviz__view-icon" size={12} />
      <span className="tipviz__bub left" />
      <span className="tipviz__bub right" />
      <span className="tipviz__bub left short" />
      <em>Пузыри</em>
    </motion.div>
    <motion.div
      className="tipviz__views-cursor"
      animate={{
        x: [-30, -30, 126, 126, 126, 126, 264, 264, 264, 264, -30, -30],
        y: [11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11],
        opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        scale: [1, 1, 1, 0.82, 0.82, 1, 1, 0.82, 0.82, 1, 1, 1],
      }}
      transition={VIEWS_TRANSITION}
    >
      <MousePointer2 size={14} fill="currentColor" />
    </motion.div>
  </div>
);

const vizSections = (
  <div className="tipviz tipviz--sections">
    <motion.div
      className="tipviz__cursor"
      animate={{
        x: [-30, -30, 0, 0, 0, 0, 0, 0, 0, 0, -30, -30],
        y: [12, 12, 12, 12, 41, 41, 70, 70, 12, 12, 12, 12],
        opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
        scale: [1, 1, 1, 0.82, 0.82, 1, 1, 0.82, 0.82, 1, 1, 1],
      }}
      transition={SECTION_CYCLE_TRANSITION}
    >
      <motion.span
        className="tipviz__cursor-icon"
        animate={{ opacity: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1] }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "linear",
          times: [0, 0.179, 0.181, 0.399, 0.401, 0.539, 0.541, 0.759, 0.761, 1],
        }}
      >
        <MousePointer2 size={14} fill="currentColor" />
      </motion.span>
      <motion.span
        className="tipviz__cursor-icon tipviz__cursor-icon--grab"
        animate={{ opacity: [0, 0, 1, 1, 0, 0, 1, 1, 0, 0] }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "linear",
          times: [0, 0.179, 0.181, 0.399, 0.401, 0.539, 0.541, 0.759, 0.761, 1],
        }}
      >
        <Hand size={16} strokeWidth={2.25} />
      </motion.span>
    </motion.div>
    <motion.div
      className="tipviz__sec"
      animate={{
        y: [0, 0, 0, 0, SECTION_STEP, SECTION_STEP, SECTION_STEP, SECTION_STEP, 2 * SECTION_STEP, 2 * SECTION_STEP, 0, 0],
        scale: [1, 1, 1, 1.04, 1.04, 1, 1, 1, 1, 1, 1, 1],
      }}
      transition={SECTION_CYCLE_TRANSITION}
    >
      <GripVertical size={12} />
      <span>Избранное</span>
    </motion.div>
    <motion.div
      className="tipviz__sec"
      animate={{ y: [0, 0, 0, 0, -SECTION_STEP, -SECTION_STEP, -SECTION_STEP, -SECTION_STEP, 0, 0, 0, 0] }}
      transition={SECTION_CYCLE_TRANSITION}
    >
      <GripVertical size={12} />
      <span>Каналы</span>
    </motion.div>
    <motion.div
      className="tipviz__sec"
      animate={{
        y: [0, 0, 0, 0, 0, 0, 0, 0, -2 * SECTION_STEP, -2 * SECTION_STEP, 0, 0],
        scale: [1, 1, 1, 1, 1, 1, 1, 1.04, 1.04, 1, 1, 1],
      }}
      transition={SECTION_CYCLE_TRANSITION}
    >
      <GripVertical size={12} />
      <span>Личные</span>
    </motion.div>
  </div>
);

const vizEsc = (
  <div className="tipviz">
    <div className="tipviz__key-wrap">
      <motion.span
        className="tipviz__key-ripple"
        animate={{
          scale: [1, 1, 1, 2.1, 2.1],
          opacity: [0, 0, 0.7, 0, 0],
        }}
        transition={{ duration: ESC_TIP_DURATION, repeat: Infinity, times: [0, 0.32, 0.36, 0.85, 1], ease: "easeOut" }}
      />
      <motion.span
        className="tipviz__key-ripple"
        animate={{
          scale: [1, 1, 1, 2.4, 2.4],
          opacity: [0, 0, 0.5, 0, 0],
        }}
        transition={{ duration: ESC_TIP_DURATION, repeat: Infinity, times: [0, 0.42, 0.46, 0.95, 1], ease: "easeOut" }}
      />
      <motion.span
        className="tipviz__key"
        animate={{
          y: [0, 0, 2, 2, 0, 0],
          boxShadow: [
            "0 2px 0 var(--color-border-strong)",
            "0 2px 0 var(--color-border-strong)",
            "0 0 0 var(--color-border-strong)",
            "0 0 0 var(--color-border-strong)",
            "0 2px 0 var(--color-border-strong)",
            "0 2px 0 var(--color-border-strong)",
          ],
          backgroundColor: [
            "var(--color-bg)",
            "var(--color-bg)",
            "var(--color-bg-sunken)",
            "var(--color-bg-sunken)",
            "var(--color-bg)",
            "var(--color-bg)",
          ],
        }}
        transition={{ duration: ESC_TIP_DURATION, repeat: Infinity, times: [0, 0.3, 0.36, 0.52, 0.6, 1], ease: "easeInOut" }}
      >
        esc
      </motion.span>
    </div>
  </div>
);

const vizWelcome = (
  <div className="tipviz">
    <img className="tipviz__logo-img" src="/logo.png" alt="Surf Chat" />
  </div>
);

const TIPS = [
  {
    title: "Это Surf Chat",
    text: "Выберите чат слева — и поехали. А пока пара мелочей, которые делают список удобнее.",
    viz: vizWelcome,
  },
  {
    title: "Закрепляйте важное",
    text: "Нажмите звёздочку у чата — он переедет в «Избранное» наверх. Перетаскивайте, чтобы расставить по порядку.",
    viz: vizFav,
  },
  {
    title: "Лента — как удобнее",
    text: "В шапке открытого чата справа — иконка переключения вида. Жмёте и видите ленту строками или пузырями.",
    viz: vizViews,
  },
  {
    title: "Список под себя",
    text: "Наведите на заголовок раздела и потяните за ручку слева — меняйте местами «Избранное», «Каналы» и «Личные».",
    viz: vizSections,
  },
  {
    title: "Быстрый выход",
    text: "Открыли не тот чат? Нажмите Esc — и вернётесь на этот экран.",
    viz: vizEsc,
  },
] as const;

function EmptyTips() {
  const [[index, direction], setState] = useState<[number, 1 | -1]>([0, 1]);
  const tip = TIPS[index];

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(TIPS.length - 1, next));
    if (clamped === index) return;
    setState([clamped, clamped > index ? 1 : -1]);
  };

  return (
    <div className="tips">
      <div className="tips__card">
        <div className="tips__viewport">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={index}
              className="tips__slide"
              custom={direction}
              variants={{
                enter: (dir: 1 | -1) => ({ x: dir * 48, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (dir: 1 | -1) => ({ x: dir * -48, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition.base}
            >
              <div className="tips__visual">{tip.viz}</div>
              <div className="tips__title">{tip.title}</div>
              <div className="tips__text">{tip.text}</div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="tips__dots">
          {TIPS.map((_, tipIndex) => (
            <button
              key={tipIndex}
              type="button"
              className={`tips__dot${tipIndex === index ? " is-active" : ""}`}
              onClick={() => go(tipIndex)}
              aria-label={`Подсказка ${tipIndex + 1}`}
            />
          ))}
        </div>
      </div>
      <div className="tips__nav">
        <button type="button" className="tips__btn" onClick={() => go(index - 1)} disabled={index === 0}>
          ‹ Назад
        </button>
        <button
          type="button"
          className="tips__btn"
          onClick={() => go(index + 1)}
          disabled={index === TIPS.length - 1}
        >
          Дальше ›
        </button>
      </div>
    </div>
  );
}

function mediaKindLabel(kind: MatrixMedia["kind"]): string {
  switch (kind) {
    case "image":
      return "IMG";
    case "video":
      return "VID";
    case "audio":
      return "AUD";
    default:
      return "FILE";
  }
}

function hideImage(event: React.SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = "none";
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
  if (!mxc) return undefined;
  return client.mxcUrlToHttp(mxc, 48, 48, "crop", false, true, true) ?? undefined;
}
