import { useCallback, useSyncExternalStore } from "react";
import { loadRoomDraft } from "@matrix-platform/matrix-core";

/** Fired whenever a composer draft is saved or cleared (see useComposerDraft). */
export const DRAFTS_CHANGED_EVENT = "surf-chat:drafts-changed";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(DRAFTS_CHANGED_EVENT, onChange);
  // `storage` covers drafts written by other tabs.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DRAFTS_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Returns a `getDraft(roomId)` lookup that re-renders the caller whenever any
 * draft changes. Reads straight from localStorage so the room list stays in
 * sync with the composer without threading draft state through props.
 */
export function useRoomDrafts(): (roomId: string) => string {
  const version = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem("surf-chat:drafts:v1") ?? "",
    () => "",
  );

  return useCallback(
    (roomId: string) => {
      void version; // re-derive lookups when the draft map changes
      return loadRoomDraft(localStorage, roomId);
    },
    [version],
  );
}
