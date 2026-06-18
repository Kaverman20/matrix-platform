import { useEffect, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  createChannelRoom,
  createOrFindDirectRoom,
  createSpaceRoom,
  createSubspaceRoom,
  searchUserDirectory,
  type UserDirectoryEntry,
} from "@matrix-platform/matrix-core";

export type CreateRoomType = "private" | "public";

export type WizardItem = { id: string; name: string; kind: "channel" | "space"; parentId: string };

export type { UserDirectoryEntry };

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
  // Two-step space wizard: "form" creates the space, "channels" adds rooms/sub-spaces to it.
  const [spaceStep, setSpaceStep] = useState<"form" | "channels">("form");
  const [createdSpaceId, setCreatedSpaceId] = useState<string | null>(null);
  const [createdSpaceName, setCreatedSpaceName] = useState("");
  // Breadcrumb stack inside the wizard: [root space, ...drilled-in sub-spaces].
  const [wizardPath, setWizardPath] = useState<Array<{ id: string; name: string }>>([]);
  const [wizardItems, setWizardItems] = useState<Array<WizardItem>>([]);
  const [wizardName, setWizardName] = useState("");
  const [wizardType, setWizardType] = useState<CreateRoomType>("private");
  const [wizardPending, setWizardPending] = useState(false);

  // The "create channel" modal doubles as "create sub-space" (channelKind).
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [channelKind, setChannelKind] = useState<"channel" | "space">("channel");
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
    setWizardPath([]);
    setWizardItems([]);
    setWizardName("");
    setWizardType("private");
    setCreatingSpace(true);
  };

  const closeCreateSpace = () => {
    setCreatingSpace(false);
    setCreatingSpacePending(false);
    setSpaceStep("form");
    setCreatedSpaceId(null);
    setCreatedSpaceName("");
    setWizardPath([]);
    setWizardItems([]);
    setWizardName("");
    setWizardPending(false);
  };

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

    try {
      const spaceId = await createSpaceRoom(client, {
        name,
        isPublic: newSpaceType === "public",
        avatarFile: spaceAvatarFile,
      });

      // No default #general — advance to the wizard so the user adds the
      // channels they actually want.
      setCreatedSpaceId(spaceId);
      setCreatedSpaceName(name);
      setWizardPath([{ id: spaceId, name }]);
      setSpaceStep("channels");
    } catch (error) {
      console.error("[create-space]", error);
      window.alert("Не удалось создать пространство.");
    } finally {
      setCreatingSpacePending(false);
    }
  };

  const addWizardChannel = async () => {
    const name = wizardName.trim();
    const target = wizardPath[wizardPath.length - 1];
    if (!client || !target || !name || wizardPending) return;

    setWizardPending(true);
    try {
      const roomId = await createChannelRoom(client, target.id, name, wizardType === "public");
      setWizardItems((list) => [...list, { id: roomId, name, kind: "channel", parentId: target.id }]);
      setWizardName("");
    } catch (error) {
      console.error("[wizard-channel]", error);
      window.alert("Не удалось создать канал.");
    } finally {
      setWizardPending(false);
    }
  };

  const addWizardSubspace = async () => {
    const name = wizardName.trim();
    const target = wizardPath[wizardPath.length - 1];
    if (!client || !target || !name || wizardPending) return;

    setWizardPending(true);
    try {
      const subspaceId = await createSubspaceRoom(client, target.id, name, wizardType === "public");
      setWizardItems((list) => [...list, { id: subspaceId, name, kind: "space", parentId: target.id }]);
      setWizardName("");
    } catch (error) {
      console.error("[wizard-subspace]", error);
      window.alert("Не удалось создать сабспейс.");
    } finally {
      setWizardPending(false);
    }
  };

  const enterWizardItem = (item: WizardItem) => {
    if (item.kind !== "space") return;
    setWizardPath((path) => [...path, { id: item.id, name: item.name }]);
    setWizardName("");
  };

  const wizardBack = () => {
    setWizardPath((path) => (path.length > 1 ? path.slice(0, -1) : path));
    setWizardName("");
  };

  const finishSpaceWizard = () => {
    const spaceId = createdSpaceId;
    const firstChannel = wizardItems.find((item) => item.kind === "channel" && item.parentId === spaceId);
    closeCreateSpace();
    if (spaceId) onOpenSpace(spaceId);
    if (firstChannel) onOpenRoom(firstChannel.id);
  };

  const wizardCurrent = wizardPath[wizardPath.length - 1] ?? null;
  const wizardCurrentName = wizardCurrent?.name ?? createdSpaceName;
  const wizardChildren = wizardItems.filter((item) => item.parentId === wizardCurrent?.id);
  const wizardParentName = wizardPath.length > 1 ? wizardPath[wizardPath.length - 2].name : null;

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
    // space wizard (step 2: add channels / sub-spaces, with drill-in navigation)
    spaceStep,
    wizardCurrentName,
    wizardParentName,
    wizardChildren,
    wizardItemCount: wizardItems.length,
    wizardName,
    setWizardName,
    wizardType,
    setWizardType,
    wizardPending,
    addWizardChannel,
    addWizardSubspace,
    enterWizardItem,
    wizardBack,
    finishSpaceWizard,
    // channel / sub-space (shared modal, switched by channelKind)
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
    openDirectChatWithUser,
  };
}

export type RoomCreation = ReturnType<typeof useRoomCreation>;
