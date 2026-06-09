import { AnimatePresence, motion } from "framer-motion";
import {
  AlignLeft,
  ArrowLeft,
  Bell,
  ChevronRight,
  FileText,
  GripVertical,
  Hash,
  LogOut,
  MessageSquare,
  MousePointer2,
  PanelRight,
  Phone,
  Search,
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
import { useTimelineMessages } from "../features/timeline/useTimelineMessages";
import "./chat-shell.css";

const ROOM_LIST_WIDTH = 304;
const ROOM_LIST_MAX = 440;
const ROOM_LIST_COLLAPSED_WIDTH = 84;
const ROOM_LIST_COLLAPSE_THRESHOLD = 200;
const RAIL_WIDTH = 72;
const RIGHT_PANEL_WIDTH = 320;

type RightPanelSection = "overview" | "members" | "media" | "notifications";

export function ChatShell() {
  const { client, logout, userId } = useMatrix();
  const roomGroups = useRoomGroups(client);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MatrixMessageReference | null>(null);
  const [editingMessage, setEditingMessage] = useState<MatrixMessageReference | null>(null);
  const [pendingForward, setPendingForward] = useState<MatrixForwardData[] | null>(null);
  const [forwarding, setForwarding] = useState<MatrixForwardData[] | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
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
  const favouritePersistTimer = useRef<number | null>(null);
  const composerRef = useRef<ComposerHandle | null>(null);

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
    if (action === "delete" && window.confirm("Удалить сообщение?")) {
      void client.redactEvent(activeRoomId, message.id);
    }
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
                <button type="button" className="icon-button" title="Сообщения">
                  <MessageSquare size={18} />
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
            <AnimatePresence mode="wait">
              <Timeline
                key={activeRoom.id}
                messages={messages}
                onOpenImage={setLightbox}
                onOpenMessageMenu={openMessageMenu}
                onToggleReaction={toggleReaction}
                room={activeRoom}
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
            <EmptyTips userId={userId} />
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

const EMPTY_TIPS = [
  {
    title: "Это Surf Chat",
    text: "Выберите чат слева — и поехали. Пространства в rail помогают быстро переключаться между нужными разделами.",
    visual: (
      <div className="tipviz tipviz--welcome">
        <div className="tipviz__brand">
          <span className="tipviz__brand-mark">S</span>
          <div className="tipviz__brand-body">
            <strong>Surf Chat</strong>
            <span>Matrix workspace</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Закрепляйте важное",
    text: "Нажмите звёздочку у чата — он переедет в «Избранное» наверх. Перетаскивайте, чтобы расставить по порядку.",
    visual: (
      <div className="tipviz">
        <div className="tipviz__row">
          <span className="tipviz__ava" />
          <span className="tipviz__lines">
            <i />
            <i className="short" />
          </span>
          <span className="tipviz__star">
            <Star size={16} fill="currentColor" />
          </span>
        </div>
      </div>
    ),
  },
  {
    title: "Лента — как удобнее",
    text: "В шапке открытого чата справа — иконка переключения вида. Жмёте и видите ленту строками или пузырями.",
    visual: (
      <div className="tipviz tipviz--views">
        <motion.div
          className="tipviz__views-cursor"
          animate={{ x: [10, 10, 118, 118, 10], y: [18, 18, 20, 20, 18], scale: [1, 1, 0.96, 0.96, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <MousePointer2 size={14} />
        </motion.div>
        <div className="tipviz__view">
          <AlignLeft size={12} className="tipviz__view-icon" />
          <span className="tipviz__msg" />
          <span className="tipviz__msg short" />
          <span className="tipviz__msg" />
          <em>Строки</em>
        </div>
        <div className="tipviz__view">
          <MessageSquare size={12} className="tipviz__view-icon" />
          <span className="tipviz__bub" />
          <span className="tipviz__bub right short" />
          <span className="tipviz__bub short" />
          <em>Пузыри</em>
        </div>
      </div>
    ),
  },
  {
    title: "Список под себя",
    text: "Наведите на заголовок раздела и потяните за ручку слева — меняйте местами «Избранное», «Каналы» и «Личные».",
    visual: (
      <div className="tipviz tipviz--sections">
        <motion.div
          className="tipviz__cursor"
          animate={{ x: [0, 0, 38, 38, 0], y: [0, 0, 8, 8, 0], scale: [1, 1, 0.96, 0.96, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <MousePointer2 size={14} />
        </motion.div>
        <div className="tipviz__sec">
          <Search size={12} />
          <span>Поиск</span>
        </div>
        <div className="tipviz__sec is-grab">
          <GripVertical size={12} />
          <span>Список комнат</span>
        </div>
        <div className="tipviz__sec">
          <AlignLeft size={12} />
          <span>Лента чата</span>
        </div>
      </div>
    ),
  },
  {
    title: "Быстрый выход",
    text: "Открыли не тот чат? Нажмите Esc — и вернётесь на этот экран.",
    visual: (
      <div className="tipviz">
        <div className="tipviz__key-wrap">
          <motion.span
            className="tipviz__key-ripple"
            animate={{ scale: [1, 1, 1, 2.1, 2.1], opacity: [0, 0, 0.7, 0, 0] }}
            transition={{ duration: ESC_TIP_DURATION, repeat: Infinity, times: [0, 0.32, 0.36, 0.85, 1], ease: "easeOut" }}
          />
          <motion.span
            className="tipviz__key-ripple"
            animate={{ scale: [1, 1, 1, 2.4, 2.4], opacity: [0, 0, 0.5, 0, 0] }}
            transition={{ duration: ESC_TIP_DURATION, repeat: Infinity, times: [0, 0.42, 0.46, 0.95, 1], ease: "easeOut" }}
          />
          <motion.span
            className="tipviz__key"
            animate={{
              y: [0, 0, 2, 2, 0, 0],
              boxShadow: [
                "0 2px 0 var(--color-border)",
                "0 2px 0 var(--color-border)",
                "0 0 0 var(--color-border)",
                "0 0 0 var(--color-border)",
                "0 2px 0 var(--color-border)",
                "0 2px 0 var(--color-border)",
              ],
              backgroundColor: [
                "var(--color-bg)",
                "var(--color-bg)",
                "var(--color-bg-subtle)",
                "var(--color-bg-subtle)",
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
    ),
  },
] as const;

function EmptyTips({ userId }: { userId: string | null }) {
  void userId;
  const [[index, direction], setState] = useState<[number, 1 | -1]>([0, 1]);
  const tip = EMPTY_TIPS[index];

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(EMPTY_TIPS.length - 1, next));
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
              <div className="tips__visual">{tip.visual}</div>
              <div className="tips__title">{tip.title}</div>
              <div className="tips__text">{tip.text}</div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="tips__dots">
          {EMPTY_TIPS.map((_, tipIndex) => (
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
          disabled={index === EMPTY_TIPS.length - 1}
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
