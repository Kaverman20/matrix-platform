import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  ChevronRight,
  FileText,
  Hash,
  LogOut,
  MessageSquare,
  PanelRight,
  Phone,
  Users,
  Video,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { transition } from "@matrix-platform/ui";
import {
  buildForwardData,
  removeReaction,
  sendReaction,
  type MatrixForwardData,
  type MatrixMessage,
  type MatrixMessageReference,
} from "@matrix-platform/matrix-core";
import { useMatrix } from "./providers/MatrixContext";
import { Composer } from "../features/composer/Composer";
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

export function ChatShell() {
  const { client, logout, userId } = useMatrix();
  const roomGroups = useRoomGroups(client);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MatrixMessageReference | null>(null);
  const [editingMessage, setEditingMessage] = useState<MatrixMessageReference | null>(null);
  const [pendingForward, setPendingForward] = useState<MatrixForwardData[] | null>(null);
  const [forwarding, setForwarding] = useState<MatrixForwardData[] | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [messageMenu, setMessageMenu] = useState<{
    message: MatrixMessage;
    x: number;
    y: number;
  } | null>(null);

  const allRooms = useMemo(
    () => [
      ...roomGroups.favourites,
      ...roomGroups.channels,
      ...roomGroups.dms,
    ],
    [roomGroups.channels, roomGroups.dms, roomGroups.favourites],
  );

  const activeRoom = useMemo(() => {
    return allRooms.find((room) => room.id === activeRoomId) ?? null;
  }, [activeRoomId, allRooms]);
  const messages = useTimelineMessages(client, activeRoomId);

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

  return (
    <div className="chat-shell">
      <nav className="space-rail">
        <button className="space-rail__home is-active" title="Все чаты">
          S
        </button>
        <div className="space-rail__spaces">
          {roomGroups.spaces.map((space) => (
            <button
              key={space.id}
              className="space-rail__item"
              style={{ background: space.color }}
              title={space.name}
            >
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

      <RoomList
        favourites={roomGroups.favourites}
        channels={roomGroups.channels}
        dms={roomGroups.dms}
        activeRoomId={activeRoomId}
        onSelectRoom={selectRoom}
      />

      <main className="chat-main">
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
            <h1>Surf Chat</h1>
            <p>{userId ? `Вы вошли как ${userId}` : "Выберите чат слева"}</p>
          </section>
        )}
      </main>
      <AnimatePresence initial={false}>
        {activeRoom && showRightPanel && (
          <motion.aside
            className="right-panel"
            initial={{ width: 0 }}
            animate={{ width: 320 }}
            exit={{ width: 0 }}
            transition={transition.slow}
          >
            <div className="right-panel__inner">
              <div className="right-panel__avatar" style={{ background: activeRoom.color }}>
                {activeRoom.kind === "channel" ? <Hash size={34} /> : activeRoom.name.slice(0, 1).toUpperCase()}
              </div>
              <strong className="right-panel__name">{activeRoom.name}</strong>
              <span className="right-panel__sub">
                {activeRoom.kind === "channel" ? "Канал" : "Личный чат"} · {membersLabel(activeRoom.memberCount)}
              </span>
              {activeRoom.topic && <div className="right-panel__topic">{activeRoom.topic}</div>}
              <div className="right-panel__rows">
                <button type="button" className="right-panel__row">
                  <Users size={18} />
                  <span>Участники</span>
                  <em>{activeRoom.memberCount}</em>
                  <ChevronRight size={16} />
                </button>
                <button type="button" className="right-panel__row">
                  <FileText size={18} />
                  <span>Файлы и медиа</span>
                  <ChevronRight size={16} />
                </button>
                <button type="button" className="right-panel__row">
                  <Bell size={18} />
                  <span>Уведомления</span>
                  <ChevronRight size={16} />
                </button>
              </div>
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
