import { useEffect, useMemo, useState } from "react";
import {
  ClientEvent,
  RoomEvent,
  RoomMemberEvent,
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

    const bump = () => setVersion((value) => value + 1);

    client.on(ClientEvent.Sync, bump);
    client.on(ClientEvent.AccountData, bump);
    client.on(RoomEvent.Timeline, bump);
    client.on(RoomEvent.Name, bump);
    client.on(RoomEvent.Receipt, bump);
    client.on(RoomEvent.Tags, bump);
    client.on(RoomMemberEvent.Name, bump);

    return () => {
      client.off(ClientEvent.Sync, bump);
      client.off(ClientEvent.AccountData, bump);
      client.off(RoomEvent.Timeline, bump);
      client.off(RoomEvent.Name, bump);
      client.off(RoomEvent.Receipt, bump);
      client.off(RoomEvent.Tags, bump);
      client.off(RoomMemberEvent.Name, bump);
    };
  }, [client]);

  return useMemo(() => {
    void version;
    if (!client) return EMPTY_GROUPS;
    return buildRoomGroups(client);
  }, [client, version]);
}
