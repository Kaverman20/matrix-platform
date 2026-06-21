import { useEffect, useRef } from "react";
import { clearRoomDraft, saveRoomDraft } from "@matrix-platform/matrix-core";

type Options = {
  roomId: string;
  draft: string;
  disabled?: boolean;
};

/** Persists composer draft to localStorage (per room). Hydration happens in Composer state init. */
export function useComposerDraft({ roomId, draft, disabled = false }: Options) {
  const roomIdRef = useRef(roomId);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    if (disabled) return;
    const timer = window.setTimeout(() => {
      saveRoomDraft(localStorage, roomIdRef.current, draft);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [disabled, draft]);

  const clearDraft = () => {
    clearRoomDraft(localStorage, roomIdRef.current);
  };

  return { clearDraft };
}
