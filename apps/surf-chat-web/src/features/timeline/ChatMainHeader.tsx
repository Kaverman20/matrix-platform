import { AlignLeft, Hash, MessageSquare, MessagesSquare, PanelRight, Phone, Video } from "lucide-react";
import type { MatrixRoomSummary } from "@matrix-platform/matrix-core";

type Props = {
  room: MatrixRoomSummary;
  typingLabel: string | null;
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
        {room.kind === "channel" && <Hash size={18} strokeWidth={2.5} />}
        <div className="chat-main__title-text">
          <h1>{room.name}</h1>
          {typingLabel && <span className="chat-main__typing">{typingLabel}</span>}
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
