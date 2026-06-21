const SCROLL_STORAGE_PREFIX = "surf-chat:room-scroll:";

/** Distance from the bottom (px) under which the timeline is treated as "at the bottom". */
export const BOTTOM_THRESHOLD = 160;

const scrollStorageKey = (roomId: string) => `${SCROLL_STORAGE_PREFIX}${roomId}`;

export function getStoredDistanceFromBottom(roomId: string): number | null {
  const raw = window.localStorage.getItem(scrollStorageKey(roomId));
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function storeDistanceFromBottom(roomId: string, el: HTMLElement, pinnedToBottom = false): void {
  if (pinnedToBottom) {
    window.localStorage.setItem(scrollStorageKey(roomId), "0");
    return;
  }

  const distance = Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight);
  window.localStorage.setItem(scrollStorageKey(roomId), String(Math.round(distance)));
}

export function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
}
