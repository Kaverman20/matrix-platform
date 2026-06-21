import { useEffect } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import { useSpaceCreation } from "./useSpaceCreation";
import { useChannelCreation } from "./useChannelCreation";
import { useDmCreation } from "./useDmCreation";

export type { CreateRoomType, WizardItem } from "./roomCreationTypes";
export type { UserDirectoryEntry } from "@matrix-platform/matrix-core";

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
 * Owns every "create a space / channel / direct chat" workflow by composing the
 * three independent sub-hooks and adding the shared Escape-to-close handler.
 * ChatShell consumes the returned API and renders <CreateModals creation={...} />.
 */
export function useRoomCreation({ client, activeSpaceId, onOpenRoom, onOpenSpace }: Options) {
  const space = useSpaceCreation({ client, onOpenRoom, onOpenSpace });
  const channel = useChannelCreation({ client, activeSpaceId, onOpenRoom, onOpenSpace });
  const dm = useDmCreation({ client, onOpenRoom });

  // Shared Escape handler — closes the topmost open modal (dm → channel → space).
  useEffect(() => {
    if (!space.creatingSpace && !channel.creatingChannel && !dm.creatingDm) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (dm.creatingDm) {
          dm.closeCreateDm();
          return;
        }
        if (channel.creatingChannel) {
          channel.closeCreateChannel();
          return;
        }
        space.closeCreateSpace();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [space, channel, dm]);

  return {
    ...space,
    ...channel,
    ...dm,
  };
}

export type RoomCreation = ReturnType<typeof useRoomCreation>;
