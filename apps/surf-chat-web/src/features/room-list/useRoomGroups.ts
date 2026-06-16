import { useEffect, useMemo, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  buildRoomGroups,
  subscribeRoomGroups,
  type MatrixRoomGroups,
} from "@matrix-platform/matrix-core";

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

    return subscribeRoomGroups(client, () => setVersion((value) => value + 1));
  }, [client]);

  return useMemo(() => {
    void version;
    if (!client) return EMPTY_GROUPS;
    return buildRoomGroups(client);
  }, [client, version]);
}
