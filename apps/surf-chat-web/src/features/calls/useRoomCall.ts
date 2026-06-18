import { useCallback, useEffect, useRef, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import type { MatrixRTCSession } from "matrix-js-sdk/lib/matrixrtc";
import type { Room } from "livekit-client";
import { joinCall, leaveCall, subscribePeerDeclined } from "@matrix-platform/matrix-core";
import { fetchLiveKitCredentials } from "./fetchLiveKitJwt";
import {
  connectLiveKitRoom,
  disconnectLiveKitRoom,
  setLiveKitMicrophoneMuted,
} from "./livekitSession";
import { mapCallError } from "./mapCallError";
import { startRingback, type Ringback } from "./ringback";

export type CallStatus =
  | "idle"
  | "connecting" // setting up Matrix membership + LiveKit
  | "ringing" // connected, waiting for the other side to join (outgoing)
  | "connected" // peer is in the call — duration ticks
  | "error";

/** How long an outgoing call rings before giving up (no answer / declined). */
const RING_TIMEOUT_MS = 30_000;

/** How long to show a terminal error (declined, no answer, connection failed) before closing. */
const ERROR_DISMISS_MS = 4_000;

export type StartCallOptions = {
  /** Emit MatrixRTC ring notification (outgoing call). */
  ring?: boolean;
  /** Override the hook's default room (e.g. answer from incoming banner). */
  roomId?: string;
};

export type RoomCall = {
  status: CallStatus;
  error: string | null;
  muted: boolean;
  /** Seconds since the peer joined; only meaningful while `connected`. */
  durationSec: number;
  /** Room the active call belongs to — independent of the chat being viewed. */
  callRoomId: string | null;
  start: (options?: StartCallOptions) => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
};

/**
 * Orchestrates a 1:1 room call: MatrixRTC membership (matrix-core) plus LiveKit
 * media (livekit-client). Phone-like UX — ringback while waiting, an in-call
 * timer once the peer joins, a no-answer timeout, and auto-end when they leave.
 */
export function useRoomCall(client: MatrixClient | null, roomId: string | null): RoomCall {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [outgoing, setOutgoing] = useState(false);
  const [callRoomId, setCallRoomId] = useState<string | null>(null);
  const sessionRef = useRef<MatrixRTCSession | null>(null);
  const liveKitRef = useRef<Room | null>(null);
  const liveKitUnwatchRef = useRef<(() => void) | null>(null);
  const wasConnectedRef = useRef(false);

  const cleanup = useCallback(async () => {
    liveKitUnwatchRef.current?.();
    liveKitUnwatchRef.current = null;
    wasConnectedRef.current = false;
    const liveKit = liveKitRef.current;
    const session = sessionRef.current;
    liveKitRef.current = null;
    sessionRef.current = null;
    await disconnectLiveKitRoom(liveKit);
    if (session) await leaveCall(session);
  }, []);

  /** Ends the call. With a reason it surfaces as an error (e.g. "Не отвечает"). */
  const endCall = useCallback(
    async (reason?: string) => {
      setStatus(reason ? "error" : "idle");
      setError(reason ?? null);
      setMuted(false);
      setDurationSec(0);
      setOutgoing(false);
      if (!reason) setCallRoomId(null);
      await cleanup();
    },
    [cleanup],
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
      const isOutgoing = options?.ring === true;
      setError(null);
      setDurationSec(0);
      setOutgoing(isOutgoing);
      setCallRoomId(targetRoomId);
      setStatus("connecting");
      wasConnectedRef.current = false;

      let session: MatrixRTCSession | null = null;
      let liveKit: Room | null = null;

      try {
        session = await joinCall(client, targetRoomId, { ring: options?.ring });
        sessionRef.current = session;

        const { wsUrl, jwt } = await fetchLiveKitCredentials(client, targetRoomId);
        const connected = await connectLiveKitRoom(wsUrl, jwt, {
          onDisconnect: () => void endCallRef.current(),
          onRemotePresence: (present) => {
            if (present) {
              wasConnectedRef.current = true;
              setStatus("connected");
            } else if (wasConnectedRef.current) {
              // Peer left an established 1:1 call → end it.
              void endCallRef.current();
            } else {
              setStatus("ringing");
            }
          },
        });
        liveKit = connected.room;
        liveKitUnwatchRef.current = connected.unwatch;
        liveKitRef.current = liveKit;

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
      }
    },
    [client, roomId],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      setLiveKitMicrophoneMuted(liveKitRef.current, next);
      return next;
    });
  }, []);

  // Ringback tone for an outgoing call, from the moment of dialling until the
  // peer joins — starts immediately (during "connecting") so there's no silent
  // gap while the LiveKit connection is set up.
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

  // Callee declined via MSC4310 rtc.decline — stop dialling immediately.
  useEffect(() => {
    if (!client || !callRoomId || !outgoing) return;
    if (status !== "connecting" && status !== "ringing") return;

    return subscribePeerDeclined(client, callRoomId, () => {
      void endCallRef.current("Абонент сбросил");
    });
  }, [callRoomId, client, outgoing, status]);

  // Brief error toast (Telegram-style) then return to idle.
  useEffect(() => {
    if (status !== "error" || !error) return;
    const id = window.setTimeout(() => {
      setStatus("idle");
      setError(null);
      setCallRoomId(null);
    }, ERROR_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [error, status]);

  // In-call timer. durationSec is reset in start()/endCall() (callbacks), so the
  // effect only ticks while connected — no synchronous setState here.
  useEffect(() => {
    if (status !== "connected") return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setDurationSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  // Tear the call down only when the whole chat unmounts (logout) — NOT when the
  // viewed room changes. The call is bound to the room captured at start(), so
  // navigating to another chat keeps it alive (Telegram-style). `cleanup` is
  // stable, so this effect runs its teardown once, on unmount.
  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  return { status, error, muted, durationSec, callRoomId, start, hangup, toggleMute };
}
