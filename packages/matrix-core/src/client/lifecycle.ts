import {
  ClientEvent,
  HttpApiEvent,
  SyncState,
  type MatrixClient,
  type Room,
} from "matrix-js-sdk";
import { ensureDirectRoomAccountData } from "../rooms/createRoom";

/** Drop a listener; calling more than once is a no-op. */
export type Unsubscribe = () => void;

export type SyncStateHandlers = {
  /** First successful sync (Prepared/Syncing) — the client is interactive. */
  onReady: () => void;
  /** Initial sync failed (bad network / invalid token without a logout signal). */
  onError: () => void;
};

/**
 * Track the initial boot sync. Fires `onReady` once the client reaches
 * Prepared/Syncing and `onError` if the first sync errors, then stops tracking
 * (the listener removes itself after the first decisive state). If the client is
 * already synced when called, `onReady` fires synchronously.
 *
 * Returns an unsubscribe in case the caller needs to tear down early; the
 * listener self-removes after the first ready/error regardless.
 */
export function subscribeSyncState(
  client: MatrixClient,
  { onReady, onError }: SyncStateHandlers,
): Unsubscribe {
  const onSync = (state: SyncState) => {
    if (state === SyncState.Prepared || state === SyncState.Syncing) {
      client.off(ClientEvent.Sync, onSync);
      onReady();
    } else if (state === SyncState.Error) {
      client.off(ClientEvent.Sync, onSync);
      onError();
    }
  };

  client.on(ClientEvent.Sync, onSync);

  const current = client.getSyncState();
  if (current === SyncState.Prepared || current === SyncState.Syncing) {
    client.off(ClientEvent.Sync, onSync);
    onReady();
  }

  return () => client.off(ClientEvent.Sync, onSync);
}

/**
 * Watch for the server invalidating our session (token revoked / soft logout).
 * Returns an unsubscribe.
 */
export function subscribeSessionLogout(
  client: MatrixClient,
  onLoggedOut: () => void,
): Unsubscribe {
  const handler = () => onLoggedOut();
  client.on(HttpApiEvent.SessionLoggedOut, handler);
  return () => client.off(HttpApiEvent.SessionLoggedOut, handler);
}

/**
 * Auto-join direct-message invites: any room we're invited to by a DM inviter
 * gets joined and recorded in `m.direct` account data. Applies to rooms already
 * present and to ones that arrive later. Returns an unsubscribe.
 */
export function setupDirectInviteAutoJoin(client: MatrixClient): Unsubscribe {
  const joining = new Set<string>();

  const tryJoin = (room: Room) => {
    const inviter = room.getDMInviter();
    if (room.getMyMembership() !== "invite" || !inviter || joining.has(room.roomId)) return;

    joining.add(room.roomId);
    void client
      .joinRoom(room.roomId)
      .then(() => ensureDirectRoomAccountData(client, inviter, room.roomId))
      .catch((error) => {
        console.error("[dm-auto-join]", error);
      })
      .finally(() => {
        joining.delete(room.roomId);
      });
  };

  client.getRooms().forEach(tryJoin);
  client.on(ClientEvent.Room, tryJoin);

  return () => client.off(ClientEvent.Room, tryJoin);
}
