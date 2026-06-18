/** Query params used to deep-link into a Matrix room or space. */
export const ROOM_URL_PARAM = "room";
export const SPACE_URL_PARAM = "space";

export type ChatUrlState = {
  roomId: string | null;
  spaceId: string | null;
};

function readMatrixIdParam(params: URLSearchParams, key: string): string | null {
  const raw = params.get(key);
  if (!raw) return null;

  try {
    const id = decodeURIComponent(raw);
    return id.startsWith("!") ? id : null;
  } catch {
    return null;
  }
}

export function readChatUrlFromSearch(search: string): ChatUrlState {
  const params = new URLSearchParams(search);
  return {
    roomId: readMatrixIdParam(params, ROOM_URL_PARAM),
    spaceId: readMatrixIdParam(params, SPACE_URL_PARAM),
  };
}

export function readChatUrlFromLocation(location: Pick<Location, "search">): ChatUrlState {
  return readChatUrlFromSearch(location.search);
}

export function readRoomIdFromSearch(search: string): string | null {
  return readChatUrlFromSearch(search).roomId;
}

export function readRoomIdFromLocation(location: Pick<Location, "search">): string | null {
  return readChatUrlFromLocation(location).roomId;
}

export function readSpaceIdFromSearch(search: string): string | null {
  return readChatUrlFromSearch(search).spaceId;
}

export function readSpaceIdFromLocation(location: Pick<Location, "search">): string | null {
  return readChatUrlFromLocation(location).spaceId;
}

export function buildSearchWithChatState(state: ChatUrlState, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch);
  if (state.roomId) {
    params.set(ROOM_URL_PARAM, state.roomId);
  } else {
    params.delete(ROOM_URL_PARAM);
  }
  if (state.spaceId) {
    params.set(SPACE_URL_PARAM, state.spaceId);
  } else {
    params.delete(SPACE_URL_PARAM);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildSearchWithRoom(roomId: string | null, currentSearch: string): string {
  const current = readChatUrlFromSearch(currentSearch);
  return buildSearchWithChatState({ roomId, spaceId: current.spaceId }, currentSearch);
}

function historyUrl(search: string): string {
  return `${window.location.pathname}${search}${window.location.hash}`;
}

/** Push a new history entry so the browser back button returns to the prior view. */
export function pushChatToHistory(state: ChatUrlState): void {
  const search = buildSearchWithChatState(state, window.location.search);
  window.history.pushState({ surfChat: state }, "", historyUrl(search));
}

export function replaceChatInHistory(state: ChatUrlState): void {
  const search = buildSearchWithChatState(state, window.location.search);
  window.history.replaceState({ surfChat: state }, "", historyUrl(search));
}

export function pushRoomToHistory(roomId: string | null): void {
  const current = readChatUrlFromLocation(window.location);
  pushChatToHistory({ roomId, spaceId: current.spaceId });
}

export function replaceRoomInHistory(roomId: string | null): void {
  const current = readChatUrlFromLocation(window.location);
  replaceChatInHistory({ roomId, spaceId: current.spaceId });
}

export function resolveInitialActiveRoomId(storageKey: string): string | null {
  const fromUrl = readChatUrlFromLocation(window.location).roomId;
  if (fromUrl) return fromUrl;
  return window.localStorage.getItem(storageKey);
}

export function resolveInitialActiveSpaceId(storageKey: string): string | null {
  const fromUrl = readChatUrlFromLocation(window.location).spaceId;
  if (fromUrl) return fromUrl;
  return window.localStorage.getItem(storageKey);
}
