import { LogOut, X } from "lucide-react";
import { useMemo, useState } from "react";
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
              <div>
                <h1>{activeRoom.name}</h1>
                <span>
                  {activeRoom.memberCount} участников · {activeRoom.kind === "dm" ? "личный чат" : "канал"}
                </span>
              </div>
            </header>
            <Timeline
              messages={messages}
              onOpenImage={setLightbox}
              onOpenMessageMenu={openMessageMenu}
              onToggleReaction={toggleReaction}
            />
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
      {forwarding && (
        <ForwardModal
          rooms={allRooms}
          title={forwarding.length > 1 ? `Переслать (${forwarding.length}) в...` : "Переслать в..."}
          onClose={() => setForwarding(null)}
          onSelectRoom={selectForwardRoom}
        />
      )}
      {lightbox && (
        <div className="lightbox" onMouseDown={() => setLightbox(null)}>
          <img className="lightbox__image" src={lightbox} alt="" />
          <button type="button" className="lightbox__close" title="Закрыть">
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
