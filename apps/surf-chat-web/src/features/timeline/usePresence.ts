import { useEffect, useMemo, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { getUserPresence, subscribePresence, type UserPresence } from "@matrix-platform/matrix-core";

export type PresenceInfo = {
  online: boolean;
  /** Human-readable RU status for the chat header, or null when unknown. */
  label: string | null;
};

const OFFLINE: PresenceInfo = { online: false, label: null };

// When we observe a user as online we stamp the time here. Matrix's own
// `last_active_ago` is unreliable (stale on initial sync), so for anyone we've
// actually seen online this session we trust our own observation instead.
const observedOnlineAt = new Map<string, number>();

/**
 * Telegram-style presence for a single DM peer: "в сети" when active, otherwise
 * "был(а) N мин/ч/дн назад" / "был(а) недавно". Returns nothing for groups or
 * when the homeserver has no presence data.
 *
 * Note: exact last-seen time cannot be 100% accurate over Matrix — the protocol
 * has no reliable last-seen store. Online detection is reliable; the offline
 * timestamp is best-effort (our own observation when available, server data
 * otherwise).
 */
export function usePresence(
  client: MatrixClient | null,
  userId: string | null | undefined,
): PresenceInfo {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client || !userId) return;

    const stampIfOnline = () => {
      const presence = getUserPresence(client, userId);
      if (presence && (presence.currentlyActive || presence.state === "online")) {
        observedOnlineAt.set(userId, Date.now());
      }
    };

    stampIfOnline();
    return subscribePresence(client, userId, () => {
      stampIfOnline();
      setVersion((value) => value + 1);
    });
  }, [client, userId]);

  return useMemo(() => {
    void version;
    if (!client || !userId) return OFFLINE;
    const presence = getUserPresence(client, userId);
    if (!presence) return OFFLINE;
    return formatPresence(presence, observedOnlineAt.get(userId));
  }, [client, userId, version]);
}

function formatPresence(presence: UserPresence, observedOnlineTs?: number): PresenceInfo {
  if (presence.currentlyActive || presence.state === "online") {
    return { online: true, label: "в сети" };
  }

  // Prefer our own observation of when they were last online (reliable) over the
  // server's last_active_ago (flaky) — whichever is more recent.
  const lastActiveTs = Math.max(observedOnlineTs ?? 0, presence.lastActiveTs ?? 0) || undefined;

  if (lastActiveTs == null) {
    return { online: false, label: presence.state === "unavailable" ? "был(а) недавно" : "не в сети" };
  }

  const minutes = Math.floor((Date.now() - lastActiveTs) / 60_000);
  if (minutes < 1) return { online: false, label: "был(а) недавно" };
  if (minutes < 60) return { online: false, label: `был(а) ${minutes} мин назад` };

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { online: false, label: `был(а) ${hours} ч назад` };

  const days = Math.floor(hours / 24);
  if (days < 7) return { online: false, label: `был(а) ${days} дн назад` };

  return { online: false, label: "был(а) давно" };
}
