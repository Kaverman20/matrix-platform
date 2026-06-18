/** Query param used to deep-link into a Matrix room (`?room=!abc:server`). */
export const ROOM_URL_PARAM = "room";

export function readRoomIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get(ROOM_URL_PARAM);
  if (!raw) return null;

  try {
    const roomId = decodeURIComponent(raw);
    return roomId.startsWith("!") ? roomId : null;
  } catch {
    return null;
  }
}

export function readRoomIdFromLocation(location: Pick<Location, "search">): string | null {
  return readRoomIdFromSearch(location.search);
}

export function buildSearchWithRoom(roomId: string | null, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch);
  if (roomId) {
    params.set(ROOM_URL_PARAM, roomId);
  } else {
    params.delete(ROOM_URL_PARAM);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function historyUrl(search: string): string {
  return `${window.location.pathname}${search}${window.location.hash}`;
}

/** Push a new history entry so the browser back button returns to the prior room. */
export function pushRoomToHistory(roomId: string | null): void {
  const search = buildSearchWithRoom(roomId, window.location.search);
  window.history.pushState({ surfChatRoom: roomId }, "", historyUrl(search));
}

export function replaceRoomInHistory(roomId: string | null): void {
  const search = buildSearchWithRoom(roomId, window.location.search);
  window.history.replaceState({ surfChatRoom: roomId }, "", historyUrl(search));
}

export function resolveInitialActiveRoomId(storageKey: string): string | null {
  const fromUrl = readRoomIdFromLocation(window.location);
  if (fromUrl) return fromUrl;
  return window.localStorage.getItem(storageKey);
}
