import { useEffect, useMemo, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  getAllThreadSummaries,
  subscribeAllThreads,
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
    return subscribeAllThreads(client, bump);
  }, [client, active]);

  return useMemo(() => {
    void version;
    if (!client || !active) return [];
    return getAllThreadSummaries(client);
  }, [client, active, version]);
}
