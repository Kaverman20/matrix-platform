import { useCallback, useEffect, useRef, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  declineIncomingCall,
  isPendingRingId,
  subscribeIncomingCallSignals,
  type IncomingRing,
  type IncomingRingEnded,
} from "@matrix-platform/matrix-core";
import type { CallStatus } from "./useRoomCall";
import { startRingtone } from "./ringtone";

export type IncomingCall = IncomingRing;

const HANDLED_RINGS_KEY = "surf-chat-handled-rings";
const HANDLED_RING_TTL_MS = 60_000;

function ringKey(ring: IncomingRing): string {
  return `${ring.roomId}:${ring.callerId}`;
}

function loadPersistedHandledRings(): Set<string> {
  try {
    const raw = sessionStorage.getItem(HANDLED_RINGS_KEY);
    if (!raw) return new Set();
    const entries = JSON.parse(raw) as Array<{ id: string; at: number }>;
    const now = Date.now();
    const fresh = entries.filter((entry) => now - entry.at < HANDLED_RING_TTL_MS);
    sessionStorage.setItem(HANDLED_RINGS_KEY, JSON.stringify(fresh));
    return new Set(fresh.map((entry) => entry.id));
  } catch {
    return new Set();
  }
}

function persistHandledRing(id: string): void {
  try {
    const raw = sessionStorage.getItem(HANDLED_RINGS_KEY);
    const entries = raw ? (JSON.parse(raw) as Array<{ id: string; at: number }>) : [];
    const now = Date.now();
    const fresh = entries.filter((entry) => now - entry.at < HANDLED_RING_TTL_MS);
    fresh.push({ id, at: now });
    sessionStorage.setItem(HANDLED_RINGS_KEY, JSON.stringify(fresh));
  } catch {
    // sessionStorage may be unavailable in some contexts
  }
}

function shouldClearIncoming(current: IncomingCall, ended: IncomingRingEnded): boolean {
  if (current.roomId !== ended.roomId) return false;
  if (ended.callerId && current.callerId !== ended.callerId) return false;
  if (ended.notificationEventId) {
    if (current.notificationEventId === ended.notificationEventId) return true;
    if (isPendingRingId(current.notificationEventId)) return true;
    return false;
  }
  return true;
}

/**
 * Listens for MatrixRTC ring notifications in DM rooms and surfaces a floating
 * incoming-call window. Dismisses when the caller cancels or the ring expires.
 * Auto-declines with «busy» when already in another call.
 */
export function useIncomingCall(
  client: MatrixClient | null,
  dmRoomIds: readonly string[],
  callStatus: CallStatus,
): { incoming: IncomingCall | null; dismiss: () => void; decline: (ring: IncomingCall) => Promise<void> } {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const callStatusRef = useRef(callStatus);
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  const handledRingsRef = useRef(loadPersistedHandledRings());

  const markHandled = useCallback((ring: IncomingCall | null) => {
    if (!ring) return;
    handledRingsRef.current.add(ring.notificationEventId);
    handledRingsRef.current.add(ringKey(ring));
    persistHandledRing(ring.notificationEventId);
    persistHandledRing(ringKey(ring));
  }, []);

  const dismiss = useCallback(() => {
    setIncoming((current) => {
      markHandled(current);
      return null;
    });
  }, [markHandled]);

  const decline = useCallback(
    async (ring: IncomingCall) => {
      if (!client) return;
      markHandled(ring);
      try {
        if (!isPendingRingId(ring.notificationEventId)) {
          await declineIncomingCall(client, ring.roomId, ring.notificationEventId, "declined");
        }
      } finally {
        setIncoming(null);
      }
    },
    [client, markHandled],
  );

  const clearIfMatches = useCallback(
    (ended: IncomingRingEnded) => {
      setIncoming((current) => {
        if (!current || !shouldClearIncoming(current, ended)) return current;
        markHandled(current);
        return null;
      });
    },
    [markHandled],
  );

  const acceptRing = useCallback(
    (ring: IncomingRing) => {
      const key = ringKey(ring);
      if (handledRingsRef.current.has(ring.notificationEventId) || handledRingsRef.current.has(key)) {
        return;
      }

      if (callStatusRef.current !== "idle") {
        handledRingsRef.current.add(ring.notificationEventId);
        handledRingsRef.current.add(key);
        persistHandledRing(ring.notificationEventId);
        persistHandledRing(key);
        if (!isPendingRingId(ring.notificationEventId)) {
          void declineIncomingCall(client!, ring.roomId, ring.notificationEventId, "busy");
        }
        return;
      }

      setIncoming(ring);
    },
    [client],
  );

  const dmRoomIdsKey = dmRoomIds.slice().sort().join("\0");

  useEffect(() => {
    if (!client) return;
    return subscribeIncomingCallSignals(client, dmRoomIds, {
      onRing: acceptRing,
      onRingEnded: clearIfMatches,
    });
  }, [acceptRing, clearIfMatches, client, dmRoomIds, dmRoomIdsKey]);

  useEffect(() => {
    if (!incoming) return;
    const remaining = Math.max(0, incoming.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setIncoming((current) => {
        if (current?.notificationEventId === incoming.notificationEventId) {
          markHandled(current);
          return null;
        }
        return current;
      });
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [incoming, markHandled]);

  const visibleIncoming = incoming && callStatus === "idle" ? incoming : null;

  const ringActive = Boolean(visibleIncoming);
  useEffect(() => {
    if (!ringActive) return;
    const ringtone = startRingtone();
    return () => ringtone.stop();
  }, [ringActive]);

  return { incoming: visibleIncoming, dismiss, decline };
}
