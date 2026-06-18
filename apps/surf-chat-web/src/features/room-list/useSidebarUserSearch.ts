import { useEffect, useMemo, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  collectExistingDmUserIds,
  resolveSidebarUserSearch,
  searchUserDirectory,
  type UserDirectoryEntry,
} from "@matrix-platform/matrix-core";

type Options = {
  client: MatrixClient | null;
  query: string;
  existingDmUserIds: Array<string | undefined>;
};

export function useSidebarUserSearch({ client, query, existingDmUserIds }: Options) {
  const [directoryResults, setDirectoryResults] = useState<UserDirectoryEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const term = query.trim();
  const active = term.length >= 2;
  const dmUserIds = useMemo(
    () => collectExistingDmUserIds(existingDmUserIds),
    [existingDmUserIds],
  );

  useEffect(() => {
    if (!client || !active) return;

    let alive = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchUserDirectory(client, term, 8)
        .then((results) => {
          if (!alive) return;
          setDirectoryResults(results);
        })
        .catch((error) => {
          if (!alive) return;
          console.error("[sidebar-user-search]", error);
          setDirectoryResults([]);
        })
        .finally(() => {
          if (!alive) return;
          setSearching(false);
        });
    }, 180);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [active, client, term]);

  const users = useMemo(() => {
    if (!active) return [];
    return resolveSidebarUserSearch(term, directoryResults, dmUserIds);
  }, [active, term, directoryResults, dmUserIds]);

  return {
    users,
    searching: active && searching,
    active,
  };
}
