import {
  GripHorizontal,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { colorForId } from "@matrix-platform/matrix-core";
import type { IncomingCall } from "./useIncomingCall";
import { canScreenShare, type RoomCall } from "./useRoomCall";
import { formatCallDuration } from "./callDuration";
import { AuthedImage } from "../media/AuthedImage";
import { useDraggablePanel } from "./useDraggablePanel";
import "./call-panel.css";

const LAYOUT = {
  audio: { width: 300, height: 196 },
  video: { width: 400, height: 320 },
  screen: { width: 560, height: 400 },
} as const;

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
  if (call.reconnecting) return "Переподключение…";
  if (call.status === "connected") return formatCallDuration(call.durationSec);
  return STATUS_LABEL[call.status];
}

/** Floating draggable 1:1 call window — audio or video (Telegram desktop style). */
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

  const mainTrack = call.media.remoteScreen ?? call.media.remoteCamera;
  const localTrack = call.media.localCamera;
  const showVideoStage = !isIncoming && (call.mediaMode !== "audio" || Boolean(mainTrack));

  const layout = LAYOUT[isIncoming ? "audio" : call.mediaMode];
  const { position, onDragPointerDown, onDragPointerMove, onDragPointerUp } = useDraggablePanel(
    layout.width,
    layout.height,
  );

  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = mainVideoRef.current;
    if (!el || !mainTrack) return;
    mainTrack.attach(el);
    return () => void mainTrack.detach(el);
  }, [mainTrack]);

  useEffect(() => {
    const el = pipVideoRef.current;
    if (!el || !localTrack) return;
    localTrack.attach(el);
    return () => void localTrack.detach(el);
  }, [localTrack]);

  if (!isIncoming && !isActive) return null;

  const fallbackColor = colorForId((peerId ?? peerName) || "call");
  const initial = (peerName.trim()[0] ?? "?").toUpperCase();

  const avatar = (
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
  );

  return createPortal(
    <div
      className={`call-panel${showVideoStage ? " call-panel--video" : ""}`}
      role="dialog"
      aria-label={isIncoming ? `Входящий звонок от ${peerName}` : `Звонок с ${peerName}`}
      style={{ left: position.x, top: position.y, width: layout.width }}
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
        {isActive && <span className="call-panel__drag-status">{statusText(call)}</span>}
      </div>

      {isActive && (call.screenSharing || call.media.remoteScreen) && (
        <div className="call-panel__banner-screen">
          {call.screenSharing ? "Вы показываете экран" : `${peerName} показывает экран`}
        </div>
      )}

      {showVideoStage ? (
        <div className="call-panel__stage">
          {mainTrack ? (
            <video ref={mainVideoRef} className="call-panel__main-video" autoPlay playsInline />
          ) : (
            <div className="call-panel__stage-fallback">{avatar}</div>
          )}
          {call.cameraEnabled && localTrack && (
            <video
              ref={pipVideoRef}
              className="call-panel__pip"
              autoPlay
              playsInline
              muted
            />
          )}
        </div>
      ) : (
        <div className="call-panel__body">
          {avatar}
          <p className="call-panel__status">
            {isIncoming
              ? incoming?.callIntent === "video"
                ? "Входящий видеозвонок…"
                : "Входящий звонок…"
              : statusText(call)}
          </p>
        </div>
      )}

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
              className="call-panel__btn"
              aria-pressed={call.cameraEnabled}
              disabled={call.status !== "connected"}
              title={call.cameraEnabled ? "Выключить камеру" : "Включить камеру"}
              onClick={() => void call.toggleCamera()}
            >
              {call.cameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
            {canScreenShare() && (
              <button
                type="button"
                className="call-panel__btn"
                aria-pressed={call.screenSharing}
                disabled={call.status !== "connected"}
                title={call.screenSharing ? "Остановить демонстрацию" : "Показать экран"}
                onClick={() => void call.toggleScreenShare()}
              >
                {call.screenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
              </button>
            )}
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
