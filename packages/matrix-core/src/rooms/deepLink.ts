import type { MatrixClient } from "matrix-js-sdk";

import { createOrFindDirectRoom } from "./createRoom";

export type DeepLinkTarget =
  | { type: "room"; roomId: string }
  | { type: "alias"; alias: string }
  | { type: "user"; userId: string };

/** Parses `matrix.to`-style hash links: `#/!room:hs`, `#/@user:hs`, `#/#alias:hs`. */
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
    return { type: "room", roomId: fragment };
  }
  if (fragment.startsWith("@") && fragment.includes(":")) {
    return { type: "user", userId: fragment };
  }
  if (fragment.startsWith("#") && fragment.includes(":")) {
    return { type: "alias", alias: fragment };
  }

  return null;
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
