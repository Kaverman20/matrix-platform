import { useEffect, useMemo, useState } from "react";
import {
  ClientEvent,
  RoomEvent,
  RoomMemberEvent,
  RoomStateEvent,
  type MatrixClient,
} from "matrix-js-sdk";
import { buildRoomGroups, type MatrixRoomGroups } from "@matrix-platform/matrix-core";

const EMPTY_GROUPS: MatrixRoomGroups = {
  spaces: [],
  favourites: [],
  channels: [],
  dms: [],
};

export function useRoomGroups(client: MatrixClient | null): MatrixRoomGroups {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client) return;

    // Debounce: many of these events fire in bursts (initial sync, joining a
    // space), and each rebuild walks every room. Coalesce into one refresh.
    let timer: number | undefined;
    const bump = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setVersion((value) => value + 1), 120);
    };

    client.on(ClientEvent.Sync, bump);
    client.on(ClientEvent.AccountData, bump);
    client.on(RoomEvent.Timeline, bump);
    client.on(RoomEvent.Name, bump);
    client.on(RoomEvent.Receipt, bump);
    client.on(RoomEvent.Tags, bump);
    client.on(RoomMemberEvent.Name, bump);
    // Space membership / m.space.child / join-rules are state events — needed so
    // a channel added to a space appears without waiting for an unrelated event.
    client.on(RoomStateEvent.Events, bump);

    // The unread badge resets slightly after our read receipt is processed.
    // UnreadNotifications is emitted on the Room (not re-emitted by the client),
    // so listen per-room — otherwise the list shows the stale count until some
    // other event happens to fire.
    const rooms = client.getRooms();
    for (const room of rooms) room.on(RoomEvent.UnreadNotifications, bump);

    return () => {
      if (timer) window.clearTimeout(timer);
      client.off(ClientEvent.Sync, bump);
      client.off(ClientEvent.AccountData, bump);
      client.off(RoomEvent.Timeline, bump);
      client.off(RoomEvent.Name, bump);
      client.off(RoomEvent.Receipt, bump);
      client.off(RoomEvent.Tags, bump);
      client.off(RoomMemberEvent.Name, bump);
      client.off(RoomStateEvent.Events, bump);
      for (const room of rooms) room.off(RoomEvent.UnreadNotifications, bump);
    };
  }, [client]);

  return useMemo(() => {
    void version;
    if (!client) return EMPTY_GROUPS;
    return buildRoomGroups(client);
  }, [client, version]);
}
