import { useCallback, useEffect, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { subscribeIncomingRings, type IncomingRing } from "@matrix-platform/matrix-core";
import type { CallStatus } from "./useRoomCall";

export type IncomingCall = IncomingRing;

/**
 * Listens for MatrixRTC `ring` notifications in DM rooms and surfaces an in-app
 * incoming-call banner (no push / VoIP in v1).
 */
export function useIncomingCall(
  client: MatrixClient | null,
  dmRoomIds: readonly string[],
  callStatus: CallStatus,
): { incoming: IncomingCall | null; dismiss: () => void } {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  const dismiss = useCallback(() => setIncoming(null), []);

  useEffect(() => {
    if (!client) return;
    return subscribeIncomingRings(client, dmRoomIds, (ring) => {
      if (callStatus !== "idle") return;
      setIncoming(ring);
    });
  }, [callStatus, client, dmRoomIds]);

  useEffect(() => {
    if (!incoming) return;
    const remaining = Math.max(0, incoming.expiresAt - Date.now());
    const timer = window.setTimeout(() => setIncoming(null), remaining);
    return () => window.clearTimeout(timer);
  }, [incoming]);

  const visibleIncoming = incoming && callStatus === "idle" ? incoming : null;

  return { incoming: visibleIncoming, dismiss };
}
