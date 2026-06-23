import { useCallback, useEffect, useRef, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import type { MatrixRTCSession } from "matrix-js-sdk/lib/matrixrtc";
import type { LocalVideoTrack, RemoteVideoTrack, Room } from "livekit-client";
import {
  getDmPeerUserId,
  joinCall,
  leaveCall,
  sendCallSummary,
  subscribePeerDeclined,
  userIsInActiveCall,
  type CallIntent,
} from "@matrix-platform/matrix-core";
import { fetchLiveKitCredentials } from "./fetchLiveKitJwt";
import {
  connectLiveKitRoom,
  disconnectLiveKitRoom,
  setLiveKitCameraEnabled,
  setLiveKitMicrophoneMuted,
  setLiveKitScreenShareEnabled,
} from "./livekitSession";
import { mapCallError } from "./mapCallError";
import { startRingback, type Ringback } from "./ringback";

export type CallStatus =
  | "idle"
  | "connecting" // setting up Matrix membership + LiveKit
  | "ringing" // connected, waiting for the other side to join (outgoing)
  | "connected" // peer is in the call — duration ticks
  | "error";

/** Current media surface of the call (can change mid-call without re-dialling). */
export type CallMediaMode = "audio" | "video" | "screen";

/** Remote/local media tracks the CallPanel attaches to <video> elements. */
export type CallMedia = {
  localCamera: LocalVideoTrack | null;
  localScreen: LocalVideoTrack | null;
  remoteCamera: RemoteVideoTrack | null;
  remoteScreen: RemoteVideoTrack | null;
};

/** How long an outgoing call rings before giving up (no answer / declined). */
const RING_TIMEOUT_MS = 30_000;
/** How long to show a terminal error before closing. */
const ERROR_DISMISS_MS = 4_000;

export type StartCallOptions = {
  /** Emit MatrixRTC ring notification (outgoing call). */
  ring?: boolean;
  /** Override the hook's default room (e.g. answer from incoming banner). */
  roomId?: string;
  /** Audio or video call (default "audio"). */
  intent?: CallIntent;
};

export type RoomCall = {
  status: CallStatus;
  error: string | null;
  muted: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  reconnecting: boolean;
  mediaMode: CallMediaMode;
  media: CallMedia;
  /** Seconds since the peer joined; only meaningful while `connected`. */
  durationSec: number;
  /** Room the active call belongs to — independent of the chat being viewed. */
  callRoomId: string | null;
  start: (options?: StartCallOptions) => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
};

/** Whether this browser can capture a screen (hide the button otherwise). */
export function canScreenShare(): boolean {
  return typeof navigator.mediaDevices?.getDisplayMedia === "function";
}

const NO_MEDIA: CallMedia = {
  localCamera: null,
  localScreen: null,
  remoteCamera: null,
  remoteScreen: null,
};

/**
 * Orchestrates a 1:1 room call: MatrixRTC membership (matrix-core) plus LiveKit
 * media (livekit-client). Phone-like UX — ringback while waiting, an in-call
 * timer, no-answer timeout, auto-end when the peer leaves — and now audio↔video.
 */
export function useRoomCall(client: MatrixClient | null, roomId: string | null): RoomCall {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [mediaMode, setMediaMode] = useState<CallMediaMode>("audio");
  const [media, setMedia] = useState<CallMedia>(NO_MEDIA);
  const [durationSec, setDurationSec] = useState(0);
  const [outgoing, setOutgoing] = useState(false);
  const [callRoomId, setCallRoomId] = useState<string | null>(null);
  const sessionRef = useRef<MatrixRTCSession | null>(null);
  const liveKitRef = useRef<Room | null>(null);
  // True while start() is mid-setup, before sessionRef/liveKitRef are populated —
  // blocks a second start() from racing in and orphaning the first call's session.
  const startingRef = useRef(false);
  const liveKitUnwatchRef = useRef<(() => void) | null>(null);
  const wasConnectedRef = useRef(false);
  const cameraEnabledRef = useRef(false);
  const screenSharingRef = useRef(false);
  const remoteScreenRef = useRef(false);
  // Refs mirror the call's identity for endCall(), which is a stable callback and
  // can't read fresh state from its closure.
  const outgoingRef = useRef(false);
  const callRoomIdRef = useRef<string | null>(null);
  const callIntentRef = useRef<CallIntent>("audio");
  const durationRef = useRef(0);

  const cleanup = useCallback(async () => {
    liveKitUnwatchRef.current?.();
    liveKitUnwatchRef.current = null;
    wasConnectedRef.current = false;
    cameraEnabledRef.current = false;
    screenSharingRef.current = false;
    remoteScreenRef.current = false;
    const liveKit = liveKitRef.current;
    const session = sessionRef.current;
    liveKitRef.current = null;
    sessionRef.current = null;
    await disconnectLiveKitRoom(liveKit);
    if (session) await leaveCall(session);
  }, []);

  const resetMediaState = useCallback(() => {
    setMuted(false);
    setCameraEnabled(false);
    setScreenSharing(false);
    setReconnecting(false);
    setMediaMode("audio");
    setMedia(NO_MEDIA);
    cameraEnabledRef.current = false;
    screenSharingRef.current = false;
    remoteScreenRef.current = false;
  }, []);

  /** Ends the call. With a reason it surfaces as an error (e.g. "Не отвечает"). */
  const endCall = useCallback(
    async (reason?: string) => {
      // Only the caller writes the call-history line, so a 1:1 call logs once.
      if (outgoingRef.current && client && callRoomIdRef.current) {
        void sendCallSummary(client, callRoomIdRef.current, {
          answered: wasConnectedRef.current,
          durationSec: durationRef.current,
          intent: callIntentRef.current,
          busy: reason === "Занят",
        }).catch(() => undefined);
      }
      outgoingRef.current = false;
      durationRef.current = 0;
      setStatus(reason ? "error" : "idle");
      setError(reason ?? null);
      setDurationSec(0);
      setOutgoing(false);
      resetMediaState();
      if (!reason) setCallRoomId(null);
      await cleanup();
    },
    [cleanup, client, resetMediaState],
  );

  const hangup = useCallback(() => endCall(), [endCall]);

  const endCallRef = useRef(endCall);
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  const start = useCallback(
    async (options?: StartCallOptions) => {
      const targetRoomId = options?.roomId ?? roomId;
      if (!client || !targetRoomId) return;
      // Ignore a second start() while one is in flight or a call is already live,
      // so two quick clicks can't spin up two MatrixRTC/LiveKit sessions (leak).
      if (startingRef.current || sessionRef.current || liveKitRef.current) return;
      startingRef.current = true;
      const isOutgoing = options?.ring === true;
      const isVideo = options?.intent === "video";

      if (isOutgoing) {
        const peerId = getDmPeerUserId(client, targetRoomId);
        if (peerId && userIsInActiveCall(client, peerId)) {
          outgoingRef.current = true;
          callRoomIdRef.current = targetRoomId;
          callIntentRef.current = options?.intent ?? "audio";
          wasConnectedRef.current = false;
          durationRef.current = 0;
          setCallRoomId(targetRoomId);
          await endCallRef.current("Занят");
          startingRef.current = false;
          return;
        }
      }

      outgoingRef.current = isOutgoing;
      callRoomIdRef.current = targetRoomId;
      callIntentRef.current = options?.intent ?? "audio";
      durationRef.current = 0;
      setError(null);
      setDurationSec(0);
      setOutgoing(isOutgoing);
      setCallRoomId(targetRoomId);
      setStatus("connecting");
      resetMediaState();
      setMediaMode(isVideo ? "video" : "audio");
      setCameraEnabled(isVideo);
      cameraEnabledRef.current = isVideo;
      wasConnectedRef.current = false;

      let session: MatrixRTCSession | null = null;
      let liveKit: Room | null = null;

      try {
        session = await joinCall(client, targetRoomId, {
          ring: options?.ring,
          intent: options?.intent,
        });
        sessionRef.current = session;

        const { wsUrl, jwt } = await fetchLiveKitCredentials(client, targetRoomId);
        const connected = await connectLiveKitRoom(wsUrl, jwt, {
          intent: options?.intent,
          handlers: {
            onDisconnect: () => void endCallRef.current(),
            onRemotePresence: (present) => {
              if (present) {
                wasConnectedRef.current = true;
                setStatus("connected");
              } else if (wasConnectedRef.current) {
                void endCallRef.current();
              } else {
                setStatus("ringing");
              }
            },
            onRemoteVideo: (source, track) => {
              if (source === "screen") remoteScreenRef.current = Boolean(track);
              setMedia((prev) =>
                source === "screen"
                  ? { ...prev, remoteScreen: track }
                  : { ...prev, remoteCamera: track },
              );
            },
            onReconnecting: () => setReconnecting(true),
            onReconnected: () => setReconnecting(false),
          },
        });
        liveKit = connected.room;
        liveKitUnwatchRef.current = connected.unwatch;
        liveKitRef.current = liveKit;
        setMedia((prev) => ({ ...prev, localCamera: connected.localCameraTrack }));
        setMuted(false);
      } catch (err) {
        liveKitUnwatchRef.current?.();
        liveKitUnwatchRef.current = null;
        await disconnectLiveKitRoom(liveKit);
        if (session) await leaveCall(session);
        sessionRef.current = null;
        liveKitRef.current = null;
        setError(mapCallError(err));
        setStatus("error");
        setOutgoing(false);
        resetMediaState();
      } finally {
        startingRef.current = false;
      }
    },
    [client, resetMediaState, roomId],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      setLiveKitMicrophoneMuted(liveKitRef.current, next);
      return next;
    });
  }, []);

  const toggleCamera = useCallback(async () => {
    const room = liveKitRef.current;
    if (!room) return;
    const next = !cameraEnabledRef.current;
    cameraEnabledRef.current = next;
    setCameraEnabled(next);
    try {
      const track = await setLiveKitCameraEnabled(room, next);
      setMedia((prev) => ({ ...prev, localCamera: track }));
      setMediaMode(next ? "video" : "audio");
    } catch {
      // Permission denied / no camera — revert to audio, call continues.
      cameraEnabledRef.current = false;
      setCameraEnabled(false);
      setMedia((prev) => ({ ...prev, localCamera: null }));
      setMediaMode("audio");
      setError("Нет доступа к камере");
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const room = liveKitRef.current;
    if (!room || !canScreenShare()) return;
    const next = !screenSharingRef.current;
    if (next && remoteScreenRef.current) {
      setError("Собеседник уже показывает экран");
      return;
    }
    try {
      const screenTrack = await setLiveKitScreenShareEnabled(room, next, () => {
        // Browser "Stop sharing" button.
        screenSharingRef.current = false;
        setScreenSharing(false);
        setMedia((prev) => ({ ...prev, localScreen: null }));
        setMediaMode(cameraEnabledRef.current ? "video" : "audio");
      });
      screenSharingRef.current = next;
      setScreenSharing(next);
      setMedia((prev) => ({ ...prev, localScreen: next ? screenTrack : null }));
      setMediaMode(next ? "screen" : cameraEnabledRef.current ? "video" : "audio");
    } catch {
      screenSharingRef.current = false;
      setScreenSharing(false);
      setMedia((prev) => ({ ...prev, localScreen: null }));
      setError("Не удалось начать демонстрацию");
    }
  }, []);

  // Ringback tone for an outgoing call until the peer joins — starts immediately.
  const shouldRing = outgoing && (status === "connecting" || status === "ringing");
  useEffect(() => {
    if (!shouldRing) return;
    let rb: Ringback | null = startRingback();
    return () => {
      rb?.stop();
      rb = null;
    };
  }, [shouldRing]);

  // No-answer / declined timeout: stop an unanswered outgoing call.
  useEffect(() => {
    if (!shouldRing) return;
    const id = window.setTimeout(() => void endCallRef.current("Не отвечает"), RING_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [shouldRing]);

  // Callee declined via rtc.decline — stop dialling immediately.
  useEffect(() => {
    if (!client || !callRoomId || !outgoing) return;
    if (status !== "connecting" && status !== "ringing") return;
    return subscribePeerDeclined(client, callRoomId, ({ reason }) => {
      void endCallRef.current(reason === "busy" ? "Занят" : "Абонент сбросил");
    });
  }, [callRoomId, client, outgoing, status]);

  // Brief error toast then return to idle.
  useEffect(() => {
    if (status !== "error" || !error) return;
    const id = window.setTimeout(() => {
      setStatus("idle");
      setError(null);
      setCallRoomId(null);
    }, ERROR_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [error, status]);

  // In-call timer. durationSec reset in start()/endCall(), so the effect only ticks.
  useEffect(() => {
    if (status !== "connected") return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      durationRef.current = s;
      setDurationSec(s);
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // Tear down only when the chat unmounts (logout) — NOT on viewed-room change.
  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  return {
    status,
    error,
    muted,
    cameraEnabled,
    screenSharing,
    reconnecting,
    mediaMode,
    media,
    durationSec,
    callRoomId,
    start,
    hangup,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
  };
}
