import { GripHorizontal, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { createPortal } from "react-dom";
import { colorForId } from "@matrix-platform/matrix-core";
import type { IncomingCall } from "./useIncomingCall";
import type { RoomCall } from "./useRoomCall";
import { formatCallDuration } from "./callDuration";
import { AuthedImage } from "../media/AuthedImage";
import { useDraggablePanel } from "./useDraggablePanel";
import "./call-panel.css";

const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 196;

const STATUS_LABEL: Record<RoomCall["status"], string> = {
  idle: "",
  connecting: "Соединение…",
  ringing: "Звоним…",
  connected: "В звонке",
  error: "Ошибка",
};

type Props = {
  call: RoomCall;
  incoming?: IncomingCall | null;
  onAnswer?: () => void;
  onDecline?: () => void;
  peerName: string;
  peerAvatarUrl?: string;
  peerId?: string;
};

function statusText(call: RoomCall): string {
  if (call.status === "error") return call.error ?? STATUS_LABEL.error;
  if (call.status === "connected") return formatCallDuration(call.durationSec);
  return STATUS_LABEL[call.status];
}

/** Floating draggable 1:1 call window — active call or incoming ring (Telegram desktop). */
export function CallPanel({
  call,
  incoming = null,
  onAnswer,
  onDecline,
  peerName,
  peerAvatarUrl,
  peerId,
}: Props) {
  const isIncoming = Boolean(incoming && call.status === "idle");
  const isActive = call.status !== "idle";
  const { position, onDragPointerDown, onDragPointerMove, onDragPointerUp } = useDraggablePanel(
    PANEL_WIDTH,
    PANEL_HEIGHT,
  );

  if (!isIncoming && !isActive) return null;

  const fallbackColor = colorForId((peerId ?? peerName) || "call");
  const initial = (peerName.trim()[0] ?? "?").toUpperCase();

  return createPortal(
    <div
      className="call-panel"
      role="dialog"
      aria-label={isIncoming ? `Входящий звонок от ${peerName}` : `Звонок с ${peerName}`}
      style={{ left: position.x, top: position.y, width: PANEL_WIDTH }}
    >
      <div
        className="call-panel__drag"
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      >
        <GripHorizontal size={16} aria-hidden />
        <span className="call-panel__drag-label">{peerName}</span>
      </div>

      <div className="call-panel__body">
        <div
          className={`call-panel__avatar${isIncoming ? " call-panel__avatar--ringing" : ""}`}
          style={peerAvatarUrl ? undefined : { background: fallbackColor }}
        >
          {peerAvatarUrl ? (
            <AuthedImage url={peerAvatarUrl} className="call-panel__avatar-img" alt="" />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <p className="call-panel__status">
          {isIncoming ? "Входящий звонок…" : statusText(call)}
        </p>
      </div>

      <div className="call-panel__controls">
        {isIncoming ? (
          <>
            <button
              type="button"
              className="call-panel__btn call-panel__btn--answer"
              title="Ответить"
              onClick={onAnswer}
            >
              <Phone size={18} />
            </button>
            <button
              type="button"
              className="call-panel__btn call-panel__btn--hangup"
              title="Отклонить"
              onClick={onDecline}
            >
              <PhoneOff size={18} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="call-panel__btn"
              aria-pressed={call.muted}
              disabled={call.status !== "connected"}
              title={call.muted ? "Включить микрофон" : "Выключить микрофон"}
              onClick={call.toggleMute}
            >
              {call.muted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              type="button"
              className="call-panel__btn call-panel__btn--hangup"
              title="Завершить звонок"
              onClick={() => void call.hangup()}
            >
              <PhoneOff size={18} />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
