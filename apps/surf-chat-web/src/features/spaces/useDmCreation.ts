import { useEffect, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  createOrFindDirectRoom,
  searchUserDirectory,
  type UserDirectoryEntry,
} from "@matrix-platform/matrix-core";

type Options = {
  client: MatrixClient | null;
  onOpenRoom: (roomId: string) => void;
};

/** Owns the "create direct chat" modal: user-directory search + room creation. */
export function useDmCreation({ client, onOpenRoom }: Options) {
  const [creatingDm, setCreatingDm] = useState(false);
  const [dmQuery, setDmQuery] = useState("");
  const [dmResults, setDmResults] = useState<UserDirectoryEntry[]>([]);
  const [dmSearching, setDmSearching] = useState(false);
  const [selectedDmUserId, setSelectedDmUserId] = useState<string | null>(null);
  const [creatingDmPending, setCreatingDmPending] = useState(false);

  const openCreateDm = () => {
    setDmQuery("");
    setDmResults([]);
    setSelectedDmUserId(null);
    setCreatingDm(true);
  };

  const closeCreateDm = () => {
    setCreatingDm(false);
    setCreatingDmPending(false);
    setDmSearching(false);
  };

  const openDirectChatWithUser = async (targetUserId: string) => {
    if (!client || creatingDmPending) return;

    setCreatingDmPending(true);
    try {
      const roomId = await createOrFindDirectRoom(client, targetUserId);
      closeCreateDm();
      onOpenRoom(roomId);
    } catch (error) {
      console.error("[open-direct-chat]", error);
      window.alert("Не удалось открыть личный чат.");
    } finally {
      setCreatingDmPending(false);
    }
  };

  const createDirectChat = async () => {
    if (!selectedDmUserId) return;
    await openDirectChatWithUser(selectedDmUserId);
  };

  const onDmQueryChange = (value: string) => {
    setDmQuery(value);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setDmResults([]);
      setSelectedDmUserId(null);
      setDmSearching(false);
    } else {
      setDmSearching(true);
    }
  };

  useEffect(() => {
    if (!client || !creatingDm) return;

    const term = dmQuery.trim();

    if (term.length < 2) return;

    let alive = true;

    const timer = window.setTimeout(() => {
      setDmSearching(true);
      void searchUserDirectory(client, term, 8)
        .then((results) => {
          if (!alive) return;

          setDmResults(results);
          setSelectedDmUserId((current) => (
            current && results.some((entry) => entry.user_id === current)
              ? current
              : results[0]?.user_id ?? null
          ));
        })
        .catch((error) => {
          if (!alive) return;
          console.error("[search-user-directory]", error);
          setDmResults([]);
          setSelectedDmUserId(null);
        })
        .finally(() => {
          if (!alive) return;
          setDmSearching(false);
        });
    }, 180);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [client, creatingDm, dmQuery]);

  return {
    creatingDm,
    dmQuery,
    onDmQueryChange,
    dmResults,
    dmSearching,
    selectedDmUserId,
    setSelectedDmUserId,
    creatingDmPending,
    openCreateDm,
    closeCreateDm,
    createDirectChat,
    openDirectChatWithUser,
  };
}
