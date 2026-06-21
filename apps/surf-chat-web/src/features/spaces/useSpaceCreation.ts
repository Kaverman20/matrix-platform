import { useEffect, useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import {
  createChannelRoom,
  createSpaceRoom,
  createSubspaceRoom,
} from "@matrix-platform/matrix-core";
import type { CreateRoomType, WizardItem } from "./roomCreationTypes";

type Options = {
  client: MatrixClient | null;
  onOpenRoom: (roomId: string) => void;
  onOpenSpace: (spaceId: string) => void;
};

/**
 * Owns the "create space" flow: the form modal plus the two-step wizard that
 * adds channels / sub-spaces to the freshly created space (with drill-in
 * navigation between sub-spaces).
 */
export function useSpaceCreation({ client, onOpenRoom, onOpenSpace }: Options) {
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

  return {
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
  };
}
