import type { SidebarView } from "./chatUrl";

export const MULTI_TAB_CHANNEL = "surf-chat:navigation";

export type MultiTabNavMessage = {
  type: "nav";
  tabId: string;
  roomId: string | null;
  spaceId: string | null;
  sidebarView: SidebarView;
};

export type MultiTabNavState = Pick<MultiTabNavMessage, "roomId" | "spaceId" | "sidebarView">;

const SIDEBAR_VIEWS = new Set<SidebarView>(["home", "dms", "space"]);

export function parseMultiTabNavMessage(data: unknown): MultiTabNavMessage | null {
  if (!data || typeof data !== "object") return null;

  const message = data as Partial<MultiTabNavMessage>;
  if (message.type !== "nav") return null;
  if (typeof message.tabId !== "string" || !message.tabId) return null;
  if (message.roomId !== null && typeof message.roomId !== "string") return null;
  if (message.spaceId !== null && typeof message.spaceId !== "string") return null;
  if (!message.sidebarView || !SIDEBAR_VIEWS.has(message.sidebarView)) return null;

  return {
    type: "nav",
    tabId: message.tabId,
    roomId: message.roomId ?? null,
    spaceId: message.spaceId ?? null,
    sidebarView: message.sidebarView,
  };
}

export function navigationStatesEqual(a: MultiTabNavState, b: MultiTabNavState): boolean {
  return (
    a.roomId === b.roomId &&
    a.spaceId === b.spaceId &&
    a.sidebarView === b.sidebarView
  );
}

export function shouldApplyRemoteNavigation(
  message: MultiTabNavMessage,
  localTabId: string,
  current: MultiTabNavState,
): boolean {
  if (message.tabId === localTabId) return false;
  return !navigationStatesEqual(message, current);
}
