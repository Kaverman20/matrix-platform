import type { MatrixClient } from "matrix-js-sdk";

import { createOrFindDirectRoom } from "./createRoom";

export type DeepLinkTarget =
  | { type: "room"; roomId: string; eventId?: string }
  | { type: "alias"; alias: string }
  | { type: "user"; userId: string };

/** Parses `matrix.to`-style hash links: `#/!room:hs`, `#/!room:hs/$event`, `#/@user:hs`, `#/#alias:hs`. */
export function parseLocationDeepLink(location: Pick<Location, "hash">): DeepLinkTarget | null {
  let fragment = location.hash.replace(/^#/, "").trim();
  if (!fragment) return null;

  if (fragment.startsWith("/")) fragment = fragment.slice(1);

  try {
    fragment = decodeURIComponent(fragment);
  } catch {
    // keep raw fragment
  }

  if (fragment.startsWith("!") && fragment.includes(":")) {
    const parsed = parseRoomDeepLink(fragment);
    if (parsed) return parsed;
  }
  if (fragment.startsWith("@") && fragment.includes(":")) {
    return { type: "user", userId: fragment.split("?")[0] ?? fragment };
  }
  if (fragment.startsWith("#") && fragment.includes(":")) {
    return { type: "alias", alias: fragment.split("?")[0] ?? fragment };
  }

  return null;
}

function parseRoomDeepLink(fragment: string): DeepLinkTarget | null {
  const slash = fragment.indexOf("/");
  const roomId = (slash === -1 ? fragment : fragment.slice(0, slash)).split("?")[0];
  if (!roomId.startsWith("!") || !roomId.includes(":")) return null;

  let eventId: string | undefined;
  if (slash !== -1) {
    const tail = fragment.slice(slash + 1).split("?")[0];
    if (tail.startsWith("$")) eventId = tail;
  }

  return { type: "room", roomId, eventId };
}

async function ensureJoined(client: MatrixClient, roomIdOrAlias: string): Promise<string> {
  const existing = client.getRoom(roomIdOrAlias);
  if (existing?.getMyMembership() === "join") {
    return existing.roomId;
  }

  const response = await client.joinRoom(roomIdOrAlias);
  return response.roomId;
}

/**
 * Resolves a deep link into a joined room id the UI can open.
 * Throws when the target cannot be joined (unknown alias, forbidden, etc.).
 */
export async function resolveDeepLink(client: MatrixClient, target: DeepLinkTarget): Promise<string> {
  switch (target.type) {
    case "room":
      return ensureJoined(client, target.roomId);
    case "alias":
      return ensureJoined(client, target.alias);
    case "user":
      return createOrFindDirectRoom(client, target.userId);
  }
}
