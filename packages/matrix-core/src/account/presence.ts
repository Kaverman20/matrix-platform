import { UserEvent, type MatrixClient, type MatrixEvent, type User } from "matrix-js-sdk";

export type PresenceState = "online" | "offline" | "unavailable";

export type UserPresence = {
  state: PresenceState;
  /** Absolute timestamp (ms) the user was last active, if known. */
  lastActiveTs?: number;
  /** Server hint that the user is active right now (online without an exact ts). */
  currentlyActive?: boolean;
};

/** Current presence snapshot for a user, or null if the client has no data yet. */
export function getUserPresence(client: MatrixClient, userId: string): UserPresence | null {
  const user = client.getUser(userId);
  if (!user) return null;

  const state = (user.presence as PresenceState | undefined) ?? "offline";
  const lastActiveTs = typeof user.getLastActiveTs === "function" ? user.getLastActiveTs() : NaN;

  return {
    state,
    lastActiveTs: Number.isFinite(lastActiveTs) && lastActiveTs > 0 ? lastActiveTs : undefined,
    currentlyActive: user.currentlyActive ?? undefined,
  };
}

/** Calls onChange whenever the given user's presence changes. Returns an unsubscribe. */
export function subscribePresence(
  client: MatrixClient,
  userId: string,
  onChange: () => void,
): () => void {
  const handler = (_event: MatrixEvent | undefined, user: User) => {
    if (user.userId === userId) onChange();
  };
  client.on(UserEvent.Presence, handler);
  return () => {
    client.off(UserEvent.Presence, handler);
  };
}
