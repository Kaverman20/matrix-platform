/** Query params used to deep-link into a Matrix room or space. */
export const ROOM_URL_PARAM = "room";
export const SPACE_URL_PARAM = "space";
export const VIEW_URL_PARAM = "view";
export const DM_VIEW = "dms";

export type SidebarView = "home" | "dms" | "space";

export type ChatUrlState = {
  roomId: string | null;
  spaceId: string | null;
  view: typeof DM_VIEW | null;
};

export function sidebarViewFromChatUrl(state: ChatUrlState): SidebarView {
  if (state.view === DM_VIEW) return "dms";
  if (state.spaceId) return "space";
  return "home";
}

export function chatUrlFromSidebar(
  roomId: string | null,
  spaceId: string | null,
  sidebarView: SidebarView,
): ChatUrlState {
  if (sidebarView === "dms") {
    return { roomId, spaceId: null, view: DM_VIEW };
  }
  if (sidebarView === "space") {
    return { roomId, spaceId, view: null };
  }
  return { roomId, spaceId: null, view: null };
}

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
  const view = params.get(VIEW_URL_PARAM);
  return {
    roomId: readMatrixIdParam(params, ROOM_URL_PARAM),
    spaceId: readMatrixIdParam(params, SPACE_URL_PARAM),
    view: view === DM_VIEW ? DM_VIEW : null,
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
  if (state.view) {
    params.set(VIEW_URL_PARAM, state.view);
  } else {
    params.delete(VIEW_URL_PARAM);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildSearchWithRoom(roomId: string | null, currentSearch: string): string {
  const current = readChatUrlFromSearch(currentSearch);
  return buildSearchWithChatState({ ...current, roomId }, currentSearch);
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
  pushChatToHistory({ ...current, roomId });
}

export function replaceRoomInHistory(roomId: string | null): void {
  const current = readChatUrlFromLocation(window.location);
  replaceChatInHistory({ ...current, roomId });
}

export function resolveInitialActiveRoomId(storageKey: string): string | null {
  const fromUrl = readChatUrlFromLocation(window.location).roomId;
  if (fromUrl) return fromUrl;
  return window.localStorage.getItem(storageKey);
}

export function resolveInitialActiveSpaceId(storageKey: string): string | null {
  const url = readChatUrlFromLocation(window.location);
  if (url.view === DM_VIEW) return null;
  if (url.spaceId) return url.spaceId;
  return window.localStorage.getItem(storageKey);
}

export function resolveInitialSidebarView(): SidebarView {
  return sidebarViewFromChatUrl(readChatUrlFromLocation(window.location));
}
