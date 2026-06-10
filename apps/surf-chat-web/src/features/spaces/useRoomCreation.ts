import { useEffect, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";

export type CreateRoomType = "private" | "public";

export type UserDirectoryEntry = {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
};

type Options = {
  client: MatrixClient | null;
  /** Space the new channel should be parented to, or null for the flat list. */
  activeSpaceId: string | null;
  /** Opens a room in the shell once it has been created or located. */
  onOpenRoom: (roomId: string) => void;
  /** Switches the active space after a new space is created. */
  onOpenSpace: (spaceId: string) => void;
};

/**
 * Owns every "create a space / channel / direct chat" workflow: modal state,
 * the user-directory search for DMs, the shared Escape-to-close handler, and
 * the Matrix calls themselves. ChatShell consumes the returned API and renders
 * <CreateModals creation={...} />.
 */
export function useRoomCreation({ client, activeSpaceId, onOpenRoom, onOpenSpace }: Options) {
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceType, setNewSpaceType] = useState<CreateRoomType>("private");
  const [spaceAvatarFile, setSpaceAvatarFile] = useState<File | null>(null);
  const [spaceAvatarPreview, setSpaceAvatarPreview] = useState<string | null>(null);
  const [creatingSpacePending, setCreatingSpacePending] = useState(false);
  // Two-step space wizard: "form" creates the space, "channels" adds rooms to it.
  const [spaceStep, setSpaceStep] = useState<"form" | "channels">("form");
  const [createdSpaceId, setCreatedSpaceId] = useState<string | null>(null);
  const [createdSpaceName, setCreatedSpaceName] = useState("");
  const [wizardChannels, setWizardChannels] = useState<Array<{ id: string; name: string }>>([]);
  const [wizardChannelName, setWizardChannelName] = useState("");
  const [wizardChannelType, setWizardChannelType] = useState<CreateRoomType>("private");
  const [wizardChannelPending, setWizardChannelPending] = useState(false);

  const [creatingChannel, setCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<CreateRoomType>("private");
  const [creatingChannelPending, setCreatingChannelPending] = useState(false);

  const [creatingDm, setCreatingDm] = useState(false);
  const [dmQuery, setDmQuery] = useState("");
  const [dmResults, setDmResults] = useState<UserDirectoryEntry[]>([]);
  const [dmSearching, setDmSearching] = useState(false);
  const [selectedDmUserId, setSelectedDmUserId] = useState<string | null>(null);
  const [creatingDmPending, setCreatingDmPending] = useState(false);

  useEffect(() => {
    return () => {
      if (spaceAvatarPreview) {
        URL.revokeObjectURL(spaceAvatarPreview);
      }
    };
  }, [spaceAvatarPreview]);

  const openCreateSpace = () => {
    if (spaceAvatarPreview) {
      URL.revokeObjectURL(spaceAvatarPreview);
    }
    setNewSpaceName("");
    setNewSpaceType("private");
    setSpaceAvatarFile(null);
    setSpaceAvatarPreview(null);
    setSpaceStep("form");
    setCreatedSpaceId(null);
    setCreatedSpaceName("");
    setWizardChannels([]);
    setWizardChannelName("");
    setWizardChannelType("private");
    setCreatingSpace(true);
  };

  const closeCreateSpace = () => {
    setCreatingSpace(false);
    setCreatingSpacePending(false);
    setSpaceStep("form");
    setCreatedSpaceId(null);
    setCreatedSpaceName("");
    setWizardChannels([]);
    setWizardChannelName("");
    setWizardChannelPending(false);
  };

  const openCreateChannel = () => {
    setNewChannelName("");
    setNewChannelType("private");
    setCreatingChannel(true);
  };

  const closeCreateChannel = () => {
    setCreatingChannel(false);
    setCreatingChannelPending(false);
  };

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

  const setSpaceAvatar = (file: File | null) => {
    if (spaceAvatarPreview) {
      URL.revokeObjectURL(spaceAvatarPreview);
    }
    setSpaceAvatarFile(file);
    setSpaceAvatarPreview(file ? URL.createObjectURL(file) : null);
  };

  const createSpace = async () => {
    const name = newSpaceName.trim();
    if (!client || !name || creatingSpacePending) return;

    setCreatingSpacePending(true);
    const isPublic = newSpaceType === "public";

    try {
      let avatarMxc: string | undefined;
      if (spaceAvatarFile) {
        try {
          const upload = await client.uploadContent(spaceAvatarFile, { type: spaceAvatarFile.type });
          avatarMxc = (upload as { content_uri?: string }).content_uri;
        } catch (error) {
          console.error("[space-avatar-upload]", error);
        }
      }

      const spaceResult = await client.createRoom({
        name,
        creation_content: { type: "m.space" },
        preset: (isPublic ? "public_chat" : "private_chat") as never,
        ...(isPublic ? { visibility: "public" as never } : {}),
        ...(avatarMxc
          ? { initial_state: [{ type: "m.room.avatar", state_key: "", content: { url: avatarMxc } }] }
          : {}),
      } as never);

      const spaceId = (spaceResult as { room_id: string }).room_id;

      // No default #general — advance to the wizard so the user adds the
      // channels they actually want.
      setCreatedSpaceId(spaceId);
      setCreatedSpaceName(name);
      setSpaceStep("channels");
    } catch (error) {
      console.error("[create-space]", error);
      window.alert("Не удалось создать пространство.");
    } finally {
      setCreatingSpacePending(false);
    }
  };

  const addWizardChannel = async () => {
    const name = wizardChannelName.trim();
    if (!client || !createdSpaceId || !name || wizardChannelPending) return;

    setWizardChannelPending(true);
    try {
      const roomId = await createChannelRoom(client, createdSpaceId, name, wizardChannelType === "public");
      setWizardChannels((list) => [...list, { id: roomId, name }]);
      setWizardChannelName("");
    } catch (error) {
      console.error("[wizard-channel]", error);
      window.alert("Не удалось создать канал.");
    } finally {
      setWizardChannelPending(false);
    }
  };

  const finishSpaceWizard = () => {
    const spaceId = createdSpaceId;
    const firstChannel = wizardChannels[0];
    closeCreateSpace();
    if (spaceId) onOpenSpace(spaceId);
    if (firstChannel) onOpenRoom(firstChannel.id);
  };

  const createChannel = async () => {
    const name = newChannelName.trim();
    if (!client || !name || creatingChannelPending) return;

    setCreatingChannelPending(true);
    try {
      const roomId = await createChannelRoom(client, activeSpaceId, name, newChannelType === "public");
      closeCreateChannel();
      onOpenRoom(roomId);
    } catch (error) {
      console.error("[create-channel]", error);
      window.alert("Не удалось создать канал.");
    } finally {
      setCreatingChannelPending(false);
    }
  };

  const createDirectChat = async () => {
    if (!client || !selectedDmUserId || creatingDmPending) return;

    const existingRoomId = findDirectRoomId(client, selectedDmUserId);
    if (existingRoomId) {
      closeCreateDm();
      onOpenRoom(existingRoomId);
      return;
    }

    setCreatingDmPending(true);
    try {
      const result = await client.createRoom({
        is_direct: true,
        invite: [selectedDmUserId],
        preset: "trusted_private_chat" as never,
      } as never);

      const roomId = (result as { room_id: string }).room_id;
      await ensureDirectRoomAccountData(client, selectedDmUserId, roomId);

      closeCreateDm();
      onOpenRoom(roomId);
    } catch (error) {
      console.error("[create-dm]", error);
      window.alert("Не удалось создать личный чат.");
    } finally {
      setCreatingDmPending(false);
    }
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
    const myUserId = client.getUserId();

    if (term.length < 2) return;

    let alive = true;

    const timer = window.setTimeout(() => {
      setDmSearching(true);
      void client.searchUserDirectory({ term, limit: 8 })
        .then((response) => {
          if (!alive) return;

          const results = (response.results ?? [])
            .filter((entry) => entry.user_id !== myUserId)
            .map((entry) => ({
              user_id: entry.user_id,
              display_name: entry.display_name,
              avatar_url: entry.avatar_url,
            }));

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

  useEffect(() => {
    if (!creatingSpace && !creatingChannel && !creatingDm) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (creatingDm) {
          closeCreateDm();
          return;
        }
        if (creatingChannel) {
          closeCreateChannel();
          return;
        }
        closeCreateSpace();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creatingChannel, creatingDm, creatingSpace]);

  return {
    // space
    creatingSpace,
    newSpaceName,
    setNewSpaceName,
    newSpaceType,
    setNewSpaceType,
    spaceAvatarPreview,
    setSpaceAvatar,
    creatingSpacePending,
    openCreateSpace,
    closeCreateSpace,
    createSpace,
    // space wizard (step 2: add channels to the just-created space)
    spaceStep,
    createdSpaceName,
    wizardChannels,
    wizardChannelName,
    setWizardChannelName,
    wizardChannelType,
    setWizardChannelType,
    wizardChannelPending,
    addWizardChannel,
    finishSpaceWizard,
    // channel
    creatingChannel,
    newChannelName,
    setNewChannelName,
    newChannelType,
    setNewChannelType,
    creatingChannelPending,
    openCreateChannel,
    closeCreateChannel,
    createChannel,
    // dm
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
  };
}

export type RoomCreation = ReturnType<typeof useRoomCreation>;

/**
 * Creates a channel room, optionally parenting it to a space via
 * m.space.parent / m.space.child. Returns the new room id.
 */
async function createChannelRoom(
  client: MatrixClient,
  spaceId: string | null,
  name: string,
  isPublic: boolean,
): Promise<string> {
  const server = client.getDomain() ?? "";
  const initialState: Array<{ type: string; state_key: string; content: Record<string, unknown> }> = [];

  if (spaceId) {
    if (isPublic) {
      initialState.push({
        type: "m.space.parent",
        state_key: spaceId,
        content: { canonical: true, via: [server] },
      });
    } else {
      initialState.push(
        {
          type: "m.room.join_rules",
          state_key: "",
          content: {
            join_rule: "restricted",
            allow: [{ type: "m.room_membership", room_id: spaceId }],
          },
        },
        {
          type: "m.space.parent",
          state_key: spaceId,
          content: { canonical: true, via: [server] },
        },
      );
    }
  }

  const result = await client.createRoom({
    name,
    preset: (isPublic ? "public_chat" : "private_chat") as never,
    ...(isPublic ? { visibility: "public" as never } : {}),
    ...(initialState.length > 0 ? { initial_state: initialState as never } : {}),
  } as never);

  const roomId = (result as { room_id: string }).room_id;

  if (spaceId) {
    await client.sendStateEvent(spaceId, "m.space.child" as never, { via: [server] } as never, roomId);
  }

  return roomId;
}

function findDirectRoomId(client: MatrixClient, targetUserId: string): string | null {
  const direct = (client.getAccountData("m.direct" as never)?.getContent() ?? {}) as Record<string, string[]>;
  const explicit = Array.isArray(direct[targetUserId]) ? direct[targetUserId] : [];

  for (const roomId of explicit) {
    const room = client.getRoom(roomId);
    if (room && room.getMyMembership() === "join") return roomId;
  }

  const me = client.getUserId();
  for (const room of client.getRooms()) {
    if (room.isSpaceRoom()) continue;
    if (room.getMyMembership() !== "join") continue;
    const members = room.getJoinedMembers();
    if (members.length !== 2) continue;
    const hasTarget = members.some((member) => member.userId === targetUserId);
    const hasMe = members.some((member) => member.userId === me);
    if (hasTarget && hasMe) return room.roomId;
  }

  return null;
}

async function ensureDirectRoomAccountData(client: MatrixClient, targetUserId: string, roomId: string): Promise<void> {
  const content = {
    ...((client.getAccountData("m.direct" as never)?.getContent() ?? {}) as Record<string, string[]>),
  };
  const roomIds = new Set(content[targetUserId] ?? []);
  roomIds.add(roomId);
  content[targetUserId] = Array.from(roomIds);
  await client.setAccountData("m.direct" as never, content as never);
}
