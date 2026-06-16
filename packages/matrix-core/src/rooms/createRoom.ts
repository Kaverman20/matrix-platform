import type { MatrixClient, Room } from "matrix-js-sdk";

export type UserDirectoryEntry = {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
};

export type CreateSpaceInput = {
  name: string;
  isPublic: boolean;
  avatarFile?: File | null;
};

/**
 * Creates a top-level space. Uploads the avatar first (best-effort — a failed
 * upload is logged and the space is still created without it). Returns the new
 * space's room id.
 */
export async function createSpaceRoom(
  client: MatrixClient,
  { name, isPublic, avatarFile }: CreateSpaceInput,
): Promise<string> {
  let avatarMxc: string | undefined;
  if (avatarFile) {
    try {
      const upload = await client.uploadContent(avatarFile, { type: avatarFile.type });
      avatarMxc = (upload as { content_uri?: string }).content_uri;
    } catch (error) {
      console.error("[space-avatar-upload]", error);
    }
  }

  const result = await client.createRoom({
    name,
    creation_content: { type: "m.space" },
    preset: (isPublic ? "public_chat" : "private_chat") as never,
    ...(isPublic ? { visibility: "public" as never } : {}),
    ...(avatarMxc
      ? { initial_state: [{ type: "m.room.avatar", state_key: "", content: { url: avatarMxc } }] }
      : {}),
  } as never);

  return (result as { room_id: string }).room_id;
}

/**
 * Creates a channel room, optionally parenting it to a space via
 * m.space.parent / m.space.child. Returns the new room id.
 */
export async function createChannelRoom(
  client: MatrixClient,
  spaceId: string | null,
  name: string,
  isPublic: boolean,
): Promise<string> {
  const server = client.getDomain() ?? "";
  const initialState: Array<{ type: string; state_key: string; content: Record<string, unknown> }> = [];

  if (spaceId) {
    if (isPublic) {
      initialState.push({
        type: "m.space.parent",
        state_key: spaceId,
        content: { canonical: true, via: [server] },
      });
    } else {
      initialState.push(
        {
          type: "m.room.join_rules",
          state_key: "",
          content: {
            join_rule: "restricted",
            allow: [{ type: "m.room_membership", room_id: spaceId }],
          },
        },
        {
          type: "m.space.parent",
          state_key: spaceId,
          content: { canonical: true, via: [server] },
        },
      );
    }
  }

  const result = await client.createRoom({
    name,
    preset: (isPublic ? "public_chat" : "private_chat") as never,
    ...(isPublic ? { visibility: "public" as never } : {}),
    ...(initialState.length > 0 ? { initial_state: initialState as never } : {}),
  } as never);

  const roomId = (result as { room_id: string }).room_id;

  if (spaceId) {
    await client.sendStateEvent(spaceId, "m.space.child" as never, { via: [server] } as never, roomId);
  }

  return roomId;
}

/**
 * Creates a sub-space (a space room) parented to parentSpaceId via
 * m.space.parent / m.space.child. Returns the new space's room id.
 */
export async function createSubspaceRoom(
  client: MatrixClient,
  parentSpaceId: string,
  name: string,
  isPublic: boolean,
): Promise<string> {
  const server = client.getDomain() ?? "";
  const initialState: Array<{ type: string; state_key: string; content: Record<string, unknown> }> = [
    {
      type: "m.space.parent",
      state_key: parentSpaceId,
      content: { canonical: true, via: [server] },
    },
  ];

  if (!isPublic) {
    initialState.unshift({
      type: "m.room.join_rules",
      state_key: "",
      content: {
        join_rule: "restricted",
        allow: [{ type: "m.room_membership", room_id: parentSpaceId }],
      },
    });
  }

  const result = await client.createRoom({
    name,
    creation_content: { type: "m.space" },
    preset: (isPublic ? "public_chat" : "private_chat") as never,
    ...(isPublic ? { visibility: "public" as never } : {}),
    initial_state: initialState as never,
  } as never);

  const subspaceId = (result as { room_id: string }).room_id;
  await client.sendStateEvent(parentSpaceId, "m.space.child" as never, { via: [server] } as never, subspaceId);

  return subspaceId;
}

/**
 * Opens (or creates) a 1:1 direct chat with targetUserId. Reuses an existing DM
 * room when one is found — joining it first if we were only invited — otherwise
 * creates a fresh invite-only DM. Records the room in m.direct either way.
 * Returns the room id to open.
 */
export async function createOrFindDirectRoom(
  client: MatrixClient,
  targetUserId: string,
): Promise<string> {
  const existingRoom = findDirectRoom(client, targetUserId);
  if (existingRoom) {
    if (existingRoom.getMyMembership() === "invite") {
      await client.joinRoom(existingRoom.roomId);
      await ensureDirectRoomAccountData(client, targetUserId, existingRoom.roomId);
    }
    return existingRoom.roomId;
  }

  const result = await client.createRoom({
    is_direct: true,
    invite: [targetUserId],
    preset: "trusted_private_chat" as never,
  } as never);

  const roomId = (result as { room_id: string }).room_id;
  await ensureDirectRoomAccountData(client, targetUserId, roomId);
  return roomId;
}

/** Finds an existing 1:1 DM room with targetUserId, or null. */
export function findDirectRoom(client: MatrixClient, targetUserId: string): Room | null {
  const direct = (client.getAccountData("m.direct" as never)?.getContent() ?? {}) as Record<string, string[]>;
  const explicit = Array.isArray(direct[targetUserId]) ? direct[targetUserId] : [];

  for (const roomId of explicit) {
    const room = client.getRoom(roomId);
    if (room && (room.getMyMembership() === "join" || room.getMyMembership() === "invite")) return room;
  }

  const me = client.getUserId();
  for (const room of client.getRooms()) {
    if (room.isSpaceRoom()) continue;
    if (room.getMyMembership() === "invite" && room.getDMInviter() === targetUserId) return room;
    if (room.getMyMembership() !== "join") continue;
    const members = room.getJoinedMembers();
    if (members.length !== 2) continue;
    const hasTarget = members.some((member) => member.userId === targetUserId);
    const hasMe = members.some((member) => member.userId === me);
    if (hasTarget && hasMe) return room;
  }

  return null;
}

/** Records roomId under targetUserId in the m.direct account data, idempotently. */
export async function ensureDirectRoomAccountData(
  client: MatrixClient,
  targetUserId: string,
  roomId: string,
): Promise<void> {
  const content = {
    ...((client.getAccountData("m.direct" as never)?.getContent() ?? {}) as Record<string, string[]>),
  };
  const roomIds = new Set(content[targetUserId] ?? []);
  roomIds.add(roomId);
  content[targetUserId] = Array.from(roomIds);
  await client.setAccountData("m.direct" as never, content as never);
}

/**
 * Searches the homeserver user directory, dropping the current user from the
 * results. Returns directory entries trimmed to the fields the UI needs.
 */
export async function searchUserDirectory(
  client: MatrixClient,
  term: string,
  limit = 8,
): Promise<UserDirectoryEntry[]> {
  const myUserId = client.getUserId();
  const response = await client.searchUserDirectory({ term, limit });
  return (response.results ?? [])
    .filter((entry) => entry.user_id !== myUserId)
    .map((entry) => ({
      user_id: entry.user_id,
      display_name: entry.display_name,
      avatar_url: entry.avatar_url,
    }));
}
