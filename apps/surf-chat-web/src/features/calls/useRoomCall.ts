import { useCallback, useEffect, useRef, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import type { MatrixRTCSession } from "matrix-js-sdk/lib/matrixrtc";
import type { Room } from "livekit-client";
import { joinCall, leaveCall } from "@matrix-platform/matrix-core";
import { fetchLiveKitCredentials } from "./fetchLiveKitJwt";
import {
  connectLiveKitRoom,
  disconnectLiveKitRoom,
  setLiveKitMicrophoneMuted,
} from "./livekitSession";
import { startRingback, type Ringback } from "./ringback";

export type CallStatus =
  | "idle"
  | "connecting" // setting up Matrix membership + LiveKit
  | "ringing" // connected, waiting for the other side to join (outgoing)
  | "connected" // peer is in the call — duration ticks
  | "error";

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
  start: (options?: StartCallOptions) => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
};

/**
 * Orchestrates a 1:1 room call: MatrixRTC membership (matrix-core) plus LiveKit
 * media (livekit-client). Drives the phone-like UX — "ringing" with a ringback
 * tone until the peer joins, then an in-call timer; peer leaving ends the call.
 */
export function useRoomCall(client: MatrixClient | null, roomId: string | null): RoomCall {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
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
    setMuted(false);
    await disconnectLiveKitRoom(liveKit);
    if (session) await leaveCall(session);
  }, []);

  const hangup = useCallback(async () => {
    setStatus("idle");
    setError(null);
    setDurationSec(0);
    await cleanup();
  }, [cleanup]);

  const hangupRef = useRef(hangup);
  useEffect(() => {
    hangupRef.current = hangup;
  }, [hangup]);

  const start = useCallback(
    async (options?: StartCallOptions) => {
      const targetRoomId = options?.roomId ?? roomId;
      if (!client || !targetRoomId) return;
      setError(null);
      setStatus("connecting");
      setDurationSec(0);
      wasConnectedRef.current = false;

      let session: MatrixRTCSession | null = null;
      let liveKit: Room | null = null;

      try {
        session = await joinCall(client, targetRoomId, { ring: options?.ring });
        sessionRef.current = session;

        const { wsUrl, jwt } = await fetchLiveKitCredentials(client, targetRoomId);
        const connected = await connectLiveKitRoom(wsUrl, jwt, {
          onDisconnect: () => void hangupRef.current(),
          onRemotePresence: (present) => {
            if (present) {
              wasConnectedRef.current = true;
              setStatus("connected");
            } else if (wasConnectedRef.current) {
              // Peer left an established 1:1 call → end it.
              void hangupRef.current();
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
        setError(err instanceof Error ? err.message : "Не удалось начать звонок");
        setStatus("error");
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

  // Ringback tone while waiting for the peer.
  useEffect(() => {
    if (status !== "ringing") return;
    let rb: Ringback | null = startRingback();
    return () => {
      rb?.stop();
      rb = null;
    };
  }, [status]);

  // In-call timer. durationSec is reset to 0 in start()/hangup() (callbacks), so
  // the effect only needs to tick while connected — no synchronous setState here.
  useEffect(() => {
    if (status !== "connected") return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setDurationSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [roomId, cleanup]);

  return { status, error, muted, durationSec, start, hangup, toggleMute };
}
