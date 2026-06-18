import { useCallback, useEffect, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  declineIncomingCall,
  subscribeIncomingCallSignals,
  type IncomingRing,
  type IncomingRingEnded,
} from "@matrix-platform/matrix-core";
import type { CallStatus } from "./useRoomCall";

export type IncomingCall = IncomingRing;

/**
 * Listens for MatrixRTC ring notifications in DM rooms and surfaces a floating
 * incoming-call window. Dismisses when the caller cancels or the ring expires.
 */
export function useIncomingCall(
  client: MatrixClient | null,
  dmRoomIds: readonly string[],
  callStatus: CallStatus,
): { incoming: IncomingCall | null; dismiss: () => void; decline: (ring: IncomingCall) => Promise<void> } {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  const dismiss = useCallback(() => setIncoming(null), []);

  const decline = useCallback(
    async (ring: IncomingCall) => {
      if (!client) return;
      try {
        await declineIncomingCall(client, ring.roomId, ring.notificationEventId);
      } finally {
        setIncoming(null);
      }
    },
    [client],
  );

  const clearIfMatches = useCallback((ended: IncomingRingEnded) => {
    setIncoming((current) => {
      if (!current || current.roomId !== ended.roomId) return current;
      if (ended.callerId && current.callerId !== ended.callerId) return current;
      return null;
    });
  }, []);

  useEffect(() => {
    if (!client) return;
    return subscribeIncomingCallSignals(client, dmRoomIds, {
      onRing: (ring) => {
        if (callStatus !== "idle") return;
        setIncoming(ring);
      },
      onRingEnded: clearIfMatches,
    });
  }, [callStatus, clearIfMatches, client, dmRoomIds]);

  useEffect(() => {
    if (!incoming) return;
    const remaining = Math.max(0, incoming.expiresAt - Date.now());
    const timer = window.setTimeout(() => setIncoming(null), remaining);
    return () => window.clearTimeout(timer);
  }, [incoming]);

  const visibleIncoming = incoming && callStatus === "idle" ? incoming : null;

  return { incoming: visibleIncoming, dismiss, decline };
}
