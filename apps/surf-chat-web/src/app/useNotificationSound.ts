import { useEffect, useRef } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { subscribeIncomingMessages } from "@matrix-platform/matrix-core";
import { primeNotificationSound, playNotificationSound } from "./sounds/notificationSound";

// Ignore messages whose timestamp is older than this — guards against the
// initial sync replaying recent history as a burst of "new" events.
const FRESH_WINDOW_MS = 10_000;
// Don't let queued messages machine-gun the speaker.
const COOLDOWN_MS = 1500;

type Options = {
  client: MatrixClient | null;
  enabled: boolean;
  /** Currently open room — we stay quiet for it when the tab is focused. */
  activeRoomId: string | null;
};

/**
 * Plays a notification sound for incoming messages across all rooms. Stays
 * silent for the open room while the tab is focused (you can already see it),
 * but still chimes for background rooms or when the tab is hidden.
 */
export function useNotificationSound({ client, enabled, activeRoomId }: Options): void {
  // Hold mutable inputs in refs so the subscription effect doesn't re-run (and
  // re-attach SDK listeners) on every room switch or toggle flip.
  const enabledRef = useRef(enabled);
  const activeRoomIdRef = useRef(activeRoomId);
  const lastPlayedRef = useRef(0);
  // Синхронизируем рефы в эффекте, а не во время рендера (правило React Compiler:
  // «нельзя писать в ref.current во время рендера»). Эффект без deps — после каждого
  // рендера; к моменту SDK-колбэка значения уже актуальны.
  useEffect(() => {
    enabledRef.current = enabled;
    activeRoomIdRef.current = activeRoomId;
  });

  // Unlock audio on the first user gesture (autoplay policy).
  useEffect(() => {
    const prime = () => primeNotificationSound();
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);

  useEffect(() => {
    if (!client) return;
    return subscribeIncomingMessages(client, ({ roomId, ts }) => {
      if (!enabledRef.current) return;
      // Skip backfilled/old events that slip through as "live" after a reconnect.
      if (Date.now() - ts > FRESH_WINDOW_MS) return;
      // Quiet for the room you're looking at; chime for everything else.
      const focusedOnThisRoom =
        document.visibilityState === "visible" && roomId === activeRoomIdRef.current;
      if (focusedOnThisRoom) return;

      const now = Date.now();
      if (now - lastPlayedRef.current < COOLDOWN_MS) return;
      lastPlayedRef.current = now;
      playNotificationSound();
    });
  }, [client]);
}
