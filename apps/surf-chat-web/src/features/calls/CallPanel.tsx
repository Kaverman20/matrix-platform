import { Mic, MicOff, PhoneOff } from "lucide-react";
import { useState } from "react";
import type { RoomCall } from "./useRoomCall";
import "./call-panel.css";

const STATUS_LABEL: Record<RoomCall["status"], string> = {
  idle: "",
  connecting: "Соединение…",
  connected: "В звонке",
  error: "Ошибка",
};

type Props = {
  call: RoomCall;
  peerName: string;
};

/**
 * Minimal in-call surface for a 1:1 audio call. Skeleton — controls render and
 * drive the Matrix session, but mute is local-only until the LiveKit media
 * track is wired in Stage 2 (see useRoomCall TODO).
 */
export function CallPanel({ call, peerName }: Props) {
  const [muted, setMuted] = useState(false);

  if (call.status === "idle") return null;

  return (
    <div className="call-panel" role="dialog" aria-label={`Звонок с ${peerName}`}>
      <div className="call-panel__info">
        <strong className="call-panel__peer">{peerName}</strong>
        <span className="call-panel__status">
          {call.status === "error" ? call.error : STATUS_LABEL[call.status]}
        </span>
      </div>
      <div className="call-panel__controls">
        <button
          type="button"
          className="call-panel__btn"
          aria-pressed={muted}
          title={muted ? "Включить микрофон" : "Выключить микрофон"}
          onClick={() => setMuted((m) => !m)}
        >
          {muted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button
          type="button"
          className="call-panel__btn call-panel__btn--hangup"
          title="Завершить звонок"
          onClick={() => void call.hangup()}
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
