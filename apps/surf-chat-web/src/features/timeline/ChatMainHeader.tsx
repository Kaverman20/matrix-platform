import { AlignLeft, Hash, MessageSquare, MessagesSquare, PanelRight, Phone, Video } from "lucide-react";
import type { MatrixRoomSummary } from "@matrix-platform/matrix-core";
import { AuthedImage } from "../../components/AuthedImage";

type Props = {
  room: MatrixRoomSummary;
  typingLabel: string | null;
  /** DM peer presence ("в сети" / "был(а) …"); shown when nobody is typing. */
  presenceLabel?: string | null;
  presenceOnline?: boolean;
  view: "flat" | "bubbles";
  onToggleView: () => void;
  threadsActive: boolean;
  onToggleThreads: () => void;
  infoActive: boolean;
  onToggleInfo: () => void;
  /** Stage 3: show audio-call button in DM when calls are enabled. */
  callsEnabled?: boolean;
  callActive?: boolean;
  onStartCall?: () => void;
  onStartVideoCall?: () => void;
};

/** Header bar of the open chat: room title, typing indicator, and the
 * view/threads/call/info action buttons. */
export function ChatMainHeader({
  room,
  typingLabel,
  presenceLabel = null,
  presenceOnline = false,
  view,
  onToggleView,
  threadsActive,
  onToggleThreads,
  infoActive,
  onToggleInfo,
  callsEnabled = false,
  callActive = false,
  onStartCall,
  onStartVideoCall,
}: Props) {
  const showCallButton = callsEnabled && room.kind === "dm";

  return (
    <header className="chat-main__header">
      <div className="chat-main__title">
        <span className="chat-main__avatar" style={{ background: room.color }}>
          {room.kind === "channel" ? <Hash size={20} /> : room.name.slice(0, 1).toUpperCase()}
          <AuthedImage url={room.avatarUrl} className="chat-main__avatar-img" />
        </span>
        <div className="chat-main__title-text">
          <h1>{room.name}</h1>
          {typingLabel ? (
            <span className="chat-main__typing">{typingLabel}</span>
          ) : presenceLabel ? (
            <span className={`chat-main__presence${presenceOnline ? " is-online" : ""}`}>
              {presenceLabel}
            </span>
          ) : null}
        </div>
      </div>
      <div className="chat-main__actions">
        <button
          type="button"
          className="icon-button"
          title={view === "bubbles" ? "Вид: пузыри -> плоский" : "Вид: плоский -> пузыри"}
          onClick={onToggleView}
        >
          {view === "bubbles" ? <AlignLeft size={18} /> : <MessageSquare size={18} />}
        </button>
        <button
          type="button"
          className={`icon-button${threadsActive ? " is-active" : ""}`}
          title="Треды"
          onClick={onToggleThreads}
        >
          <MessagesSquare size={18} />
        </button>
        {showCallButton && (
          <button
            type="button"
            className="icon-button"
            title="Позвонить"
            disabled={callActive}
            onClick={onStartCall}
          >
            <Phone size={18} />
          </button>
        )}
        {showCallButton && (
          <button
            type="button"
            className="icon-button"
            title="Видеозвонок"
            disabled={callActive}
            onClick={onStartVideoCall}
          >
            <Video size={18} />
          </button>
        )}
        <button
          type="button"
          className={`icon-button${infoActive ? " is-active" : ""}`}
          title="Информация"
          onClick={onToggleInfo}
        >
          <PanelRight size={18} />
        </button>
      </div>
    </header>
  );
}
