import { useEffect, useRef } from "react";
import { clearRoomDraft, saveRoomDraft } from "@matrix-platform/matrix-core";
import { DRAFTS_CHANGED_EVENT } from "./useRoomDrafts";

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
      window.dispatchEvent(new Event(DRAFTS_CHANGED_EVENT));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [disabled, draft]);

  const clearDraft = () => {
    clearRoomDraft(localStorage, roomIdRef.current);
    window.dispatchEvent(new Event(DRAFTS_CHANGED_EVENT));
  };

  return { clearDraft };
}
