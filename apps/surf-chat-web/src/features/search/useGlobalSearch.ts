import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  buildGlobalSearchItems,
  collectExistingDmUserIds,
  searchGlobalMessages,
  searchGlobalUsers,
  type GlobalMessageSearchHit,
  type GlobalSearchItem,
  type MatrixRoomSummary,
  type UserDirectoryEntry,
} from "@matrix-platform/matrix-core";

type Options = {
  client: MatrixClient | null;
  rooms: MatrixRoomSummary[];
  existingDmUserIds: Array<string | undefined>;
  open: boolean;
};

export function useGlobalSearch({ client, rooms, existingDmUserIds, open }: Options) {
  const [query, setQueryState] = useState("");
  const [messageHits, setMessageHits] = useState<GlobalMessageSearchHit[]>([]);
  const [userHits, setUserHits] = useState<UserDirectoryEntry[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef<number | null>(null);

  const trimmedQuery = query.trim();
  const roomNameById = useMemo(
    () => new Map(rooms.map((room) => [room.id, room.name])),
    [rooms],
  );

  const userEntries = userHits;

  const items = useMemo(
    () => buildGlobalSearchItems({
      query,
      rooms,
      users: userEntries,
      messages: messageHits,
      roomNameById,
    }),
    [messageHits, query, roomNameById, rooms, userEntries],
  );

  const safeIndex = items.length === 0 ? 0 : Math.min(activeIndex, items.length - 1);
  const activeItem = items[safeIndex] ?? null;

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setActiveIndex(0);
    if (value.trim().length < 2) {
      setMessageHits([]);
      setUserHits([]);
    }
  }, []);

  const moveActive = useCallback((delta: number) => {
    if (items.length === 0) return;
    setActiveIndex((value) => (value + delta + items.length) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (!client || !open) return;
    const term = trimmedQuery;
    if (term.length < 2) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setMessagesLoading(true);
      setUsersLoading(true);

      void searchGlobalMessages(client, term)
        .then(setMessageHits)
        .catch((error) => {
          console.error("[global-search-messages]", error);
          setMessageHits([]);
        })
        .finally(() => setMessagesLoading(false));

      void searchGlobalUsers(
        client,
        term,
        collectExistingDmUserIds(existingDmUserIds),
      )
        .then(setUserHits)
        .catch((error) => {
          console.error("[global-search-users]", error);
          setUserHits([]);
        })
        .finally(() => setUsersLoading(false));
    }, 220);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [client, existingDmUserIds, open, trimmedQuery]);

  const loading = trimmedQuery.length >= 2 && (messagesLoading || usersLoading);
  const hasQuery = trimmedQuery.length > 0;
  const hasRemoteQuery = trimmedQuery.length >= 2;

  const sections = useMemo(() => {
    const roomItems = items.filter((item): item is Extract<GlobalSearchItem, { kind: "room" }> => item.kind === "room");
    const userItems = items.filter((item): item is Extract<GlobalSearchItem, { kind: "user" }> => item.kind === "user");
    const messageItems = items.filter((item): item is Extract<GlobalSearchItem, { kind: "message" }> => item.kind === "message");
    return { roomItems, userItems, messageItems };
  }, [items]);

  return {
    query,
    setQuery,
    items,
    sections,
    activeIndex: safeIndex,
    activeItem,
    setActiveIndex,
    moveActive,
    loading,
    hasQuery,
    hasRemoteQuery,
  };
}
