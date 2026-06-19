import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  filterLoadedMessages,
  searchRoomMessages,
  type MatrixMessage,
  type RoomMessageSearchHit,
} from "@matrix-platform/matrix-core";

type Options = {
  client: MatrixClient | null;
  roomId: string | null;
  messages: MatrixMessage[];
};

export function useRoomTimelineSearch({ client, roomId, messages }: Options) {
  const [open, setOpenState] = useState(false);
  const [query, setQueryState] = useState("");
  const [remoteHits, setRemoteHits] = useState<RoomMessageSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0);
  const debounceRef = useRef<number | null>(null);

  const trimmedQuery = query.trim();

  const localHits = useMemo(
    () => filterLoadedMessages(messages, query),
    [messages, query],
  );

  const hits = useMemo(() => {
    if (!trimmedQuery) return [];
    const remoteHitsForQuery = trimmedQuery.length >= 2 ? remoteHits : [];
    const seen = new Set<string>();
    const merged: Array<{ id: string; text: string }> = [];

    for (const hit of remoteHitsForQuery) {
      if (seen.has(hit.eventId)) continue;
      seen.add(hit.eventId);
      merged.push({ id: hit.eventId, text: hit.body });
    }
    for (const message of localHits) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);
      merged.push({ id: message.id, text: message.text });
    }
    return merged;
  }, [localHits, remoteHits, trimmedQuery]);

  const activeIndex = hits.length === 0 ? 0 : Math.min(index, hits.length - 1);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setIndex(0);
    if (value.trim().length < 2) {
      setRemoteHits([]);
    }
  }, []);

  const setOpen = useCallback((value: boolean) => {
    if (!value) {
      setQueryState("");
      setRemoteHits([]);
      setIndex(0);
    }
    setOpenState(value);
  }, []);

  useEffect(() => {
    if (!client || !roomId || !open) return;
    const term = query.trim();
    if (term.length < 2) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setLoading(true);
      void searchRoomMessages(client, roomId, term)
        .then(setRemoteHits)
        .catch((error) => {
          console.error("[room-search]", error);
          setRemoteHits([]);
        })
        .finally(() => setLoading(false));
    }, 280);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [client, open, query, roomId]);

  const currentHitId = hits[activeIndex]?.id ?? null;

  const next = useCallback(() => {
    if (hits.length === 0) return;
    setIndex((value) => (value + 1) % hits.length);
  }, [hits.length]);

  const previous = useCallback(() => {
    if (hits.length === 0) return;
    setIndex((value) => (value - 1 + hits.length) % hits.length);
  }, [hits.length]);

  return {
    open,
    setOpen,
    query,
    setQuery,
    hits,
    index: activeIndex,
    currentHitId,
    loading,
    next,
    previous,
  };
}
