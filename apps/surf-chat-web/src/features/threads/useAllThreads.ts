import { useEffect, useMemo, useState } from "react";
import { ClientEvent, RoomEvent, type MatrixClient } from "matrix-js-sdk";
import {
  getAllThreadSummaries,
  loadAllRoomThreads,
  type MatrixGlobalThreadItem,
} from "@matrix-platform/matrix-core";

/** Live list of every thread across all joined rooms (global threads view). */
export function useAllThreads(
  client: MatrixClient | null,
  active: boolean,
): MatrixGlobalThreadItem[] {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client || !active) return;

    const bump = () => setVersion((value) => value + 1);
    void loadAllRoomThreads(client).then(bump);

    client.on(RoomEvent.Timeline, bump);
    client.on(RoomEvent.Receipt, bump);
    client.on(ClientEvent.Sync, bump);

    return () => {
      client.off(RoomEvent.Timeline, bump);
      client.off(RoomEvent.Receipt, bump);
      client.off(ClientEvent.Sync, bump);
    };
  }, [client, active]);

  return useMemo(() => {
    void version;
    if (!client || !active) return [];
    return getAllThreadSummaries(client);
  }, [client, active, version]);
}
