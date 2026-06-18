import { Mic, MicOff, PhoneOff } from "lucide-react";
import type { RoomCall } from "./useRoomCall";
import { formatCallDuration } from "./callDuration";
import "./call-panel.css";

const STATUS_LABEL: Record<RoomCall["status"], string> = {
  idle: "",
  connecting: "Соединение…",
  ringing: "Звоним…",
  connected: "В звонке",
  error: "Ошибка",
};

type Props = {
  call: RoomCall;
  peerName: string;
};

/** Compact in-call bar for a 1:1 audio call (MatrixRTC + LiveKit). */
export function CallPanel({ call, peerName }: Props) {
  if (call.status === "idle") return null;

  return (
    <div className="call-panel" role="dialog" aria-label={`Звонок с ${peerName}`}>
      <div className="call-panel__info">
        <strong className="call-panel__peer">{peerName}</strong>
        <span className="call-panel__status">
          {call.status === "error"
            ? call.error
            : call.status === "connected"
              ? formatCallDuration(call.durationSec)
              : STATUS_LABEL[call.status]}
        </span>
      </div>
      <div className="call-panel__controls">
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
      </div>
    </div>
  );
}
