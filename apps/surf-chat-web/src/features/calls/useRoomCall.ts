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

export type CallStatus = "idle" | "connecting" | "connected" | "error";

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
  start: (options?: StartCallOptions) => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => void;
};

/**
 * Orchestrates a 1:1 room call: MatrixRTC membership (matrix-core) plus LiveKit
 * media (livekit-client).
 */
export function useRoomCall(client: MatrixClient | null, roomId: string | null): RoomCall {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const sessionRef = useRef<MatrixRTCSession | null>(null);
  const liveKitRef = useRef<Room | null>(null);
  const liveKitUnwatchRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(async () => {
    liveKitUnwatchRef.current?.();
    liveKitUnwatchRef.current = null;
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

      let session: MatrixRTCSession | null = null;
      let liveKit: Room | null = null;

      try {
        session = await joinCall(client, targetRoomId, { ring: options?.ring });
        sessionRef.current = session;

        const { wsUrl, jwt } = await fetchLiveKitCredentials(client, targetRoomId);
        const connected = await connectLiveKitRoom(wsUrl, jwt, () => {
          void hangupRef.current();
        });
        liveKit = connected.room;
        liveKitUnwatchRef.current = connected.unwatch;
        liveKitRef.current = liveKit;

        setMuted(false);
        setStatus("connected");
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

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [roomId, cleanup]);

  return { status, error, muted, start, hangup, toggleMute };
}
