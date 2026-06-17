import { useCallback, useRef, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import type { MatrixRTCSession } from "matrix-js-sdk/lib/matrixrtc";
import { joinCall, leaveCall } from "@matrix-platform/matrix-core";

export type CallStatus = "idle" | "connecting" | "connected" | "error";

export type RoomCall = {
  status: CallStatus;
  error: string | null;
  start: () => Promise<void>;
  hangup: () => Promise<void>;
};

/**
 * Orchestrates a 1:1 room call: Matrix signalling (via matrix-core's
 * MatrixRTCSession glue) plus — once Stage 2 lands — the LiveKit media room.
 *
 * Skeleton: the Matrix membership side is wired; the LiveKit media connection
 * (`livekit-client` Room.connect with a token from lk-jwt-service) is a TODO
 * gated behind the smoke-tested Stage 0 backend. Keeping it stubbed avoids
 * pulling in `livekit-client` before the infra exists to test it against.
 */
export function useRoomCall(client: MatrixClient | null, roomId: string | null): RoomCall {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<MatrixRTCSession | null>(null);

  const start = useCallback(async () => {
    if (!client || !roomId) return;
    setError(null);
    setStatus("connecting");
    try {
      sessionRef.current = await joinCall(client, roomId);
      // TODO(Stage 2): fetch LiveKit JWT from lk-jwt-service and
      // `await room.connect(wsUrl, token)` via livekit-client, then publish the
      // local audio track. Until then we only announce Matrix membership.
      setStatus("connected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать звонок");
      setStatus("error");
    }
  }, [client, roomId]);

  const hangup = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setStatus("idle");
    if (session) await leaveCall(session);
  }, []);

  return { status, error, start, hangup };
}
