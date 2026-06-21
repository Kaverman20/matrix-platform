import { useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { createChannelRoom, createSubspaceRoom } from "@matrix-platform/matrix-core";
import type { CreateRoomType } from "./roomCreationTypes";

type Options = {
  client: MatrixClient | null;
  /** Space the new channel should be parented to, or null for the flat list. */
  activeSpaceId: string | null;
  onOpenRoom: (roomId: string) => void;
  onOpenSpace: (spaceId: string) => void;
};

/** Owns the "create channel" modal, which doubles as "create sub-space" (channelKind). */
export function useChannelCreation({ client, activeSpaceId, onOpenRoom, onOpenSpace }: Options) {
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelKind, setChannelKind] = useState<"channel" | "space">("channel");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<CreateRoomType>("private");
  const [creatingChannelPending, setCreatingChannelPending] = useState(false);

  const openCreateChannel = () => {
    setChannelKind("channel");
    setNewChannelName("");
    setNewChannelType("private");
    setCreatingChannel(true);
  };

  const openCreateSubspace = () => {
    setChannelKind("space");
    setNewChannelName("");
    setNewChannelType("private");
    setCreatingChannel(true);
  };

  const closeCreateChannel = () => {
    setCreatingChannel(false);
    setCreatingChannelPending(false);
  };

  const createChannel = async () => {
    const name = newChannelName.trim();
    if (!client || !name || creatingChannelPending) return;
    // Sub-space creation requires a parent space (only offered inside a space).
    if (channelKind === "space" && !activeSpaceId) return;

    setCreatingChannelPending(true);
    try {
      if (channelKind === "space" && activeSpaceId) {
        const subspaceId = await createSubspaceRoom(client, activeSpaceId, name, newChannelType === "public");
        closeCreateChannel();
        onOpenSpace(subspaceId);
      } else {
        const roomId = await createChannelRoom(client, activeSpaceId, name, newChannelType === "public");
        closeCreateChannel();
        onOpenRoom(roomId);
      }
    } catch (error) {
      console.error("[create-channel]", error);
      window.alert(channelKind === "space" ? "Не удалось создать сабспейс." : "Не удалось создать канал.");
    } finally {
      setCreatingChannelPending(false);
    }
  };

  return {
    creatingChannel,
    channelKind,
    newChannelName,
    setNewChannelName,
    newChannelType,
    setNewChannelType,
    creatingChannelPending,
    openCreateChannel,
    openCreateSubspace,
    closeCreateChannel,
    createChannel,
  };
}
