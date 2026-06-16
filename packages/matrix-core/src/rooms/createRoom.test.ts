import type { MatrixClient, Room } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import {
  createChannelRoom,
  createOrFindDirectRoom,
  createSpaceRoom,
  createSubspaceRoom,
  findDirectRoom,
  searchUserDirectory,
} from "./createRoom";

describe("createSpaceRoom", () => {
  it("creates a private space without avatar", async () => {
    const createRoom = vi.fn().mockResolvedValue({ room_id: "!space:server" });
    const client = fakeClient({ createRoom });

    const id = await createSpaceRoom(client, { name: "Team", isPublic: false });

    expect(id).toBe("!space:server");
    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Team",
        creation_content: { type: "m.space" },
        preset: "private_chat",
      }),
    );
    expect(createRoom.mock.calls[0][0]).not.toHaveProperty("visibility");
    expect(createRoom.mock.calls[0][0]).not.toHaveProperty("initial_state");
  });

  it("uploads avatar and adds m.room.avatar initial state", async () => {
    const createRoom = vi.fn().mockResolvedValue({ room_id: "!space:server" });
    const uploadContent = vi.fn().mockResolvedValue({ content_uri: "mxc://server/a" });
    const client = fakeClient({ createRoom, uploadContent });
    const avatarFile = new File(["a"], "a.png", { type: "image/png" });

    await createSpaceRoom(client, { name: "Team", isPublic: true, avatarFile });

    expect(uploadContent).toHaveBeenCalledWith(avatarFile, { type: "image/png" });
    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: "public",
        preset: "public_chat",
        initial_state: [{ type: "m.room.avatar", state_key: "", content: { url: "mxc://server/a" } }],
      }),
    );
  });

  it("still creates the space when avatar upload fails", async () => {
    const createRoom = vi.fn().mockResolvedValue({ room_id: "!space:server" });
    const uploadContent = vi.fn().mockRejectedValue(new Error("boom"));
    const client = fakeClient({ createRoom, uploadContent });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const avatarFile = new File(["a"], "a.png", { type: "image/png" });

    const id = await createSpaceRoom(client, { name: "Team", isPublic: false, avatarFile });

    expect(id).toBe("!space:server");
    expect(createRoom.mock.calls[0][0]).not.toHaveProperty("initial_state");
    errSpy.mockRestore();
  });
});

describe("createChannelRoom", () => {
  it("creates a flat channel with no parent state", async () => {
    const createRoom = vi.fn().mockResolvedValue({ room_id: "!room:server" });
    const sendStateEvent = vi.fn();
    const client = fakeClient({ createRoom, sendStateEvent });

    const id = await createChannelRoom(client, null, "general", false);

    expect(id).toBe("!room:server");
    expect(createRoom.mock.calls[0][0]).not.toHaveProperty("initial_state");
    expect(sendStateEvent).not.toHaveBeenCalled();
  });

  it("parents a public channel via m.space.parent / m.space.child", async () => {
    const createRoom = vi.fn().mockResolvedValue({ room_id: "!room:server" });
    const sendStateEvent = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient({ createRoom, sendStateEvent });

    await createChannelRoom(client, "!space:server", "general", true);

    expect(createRoom.mock.calls[0][0].initial_state).toEqual([
      { type: "m.space.parent", state_key: "!space:server", content: { canonical: true, via: ["server"] } },
    ]);
    expect(sendStateEvent).toHaveBeenCalledWith(
      "!space:server",
      "m.space.child",
      { via: ["server"] },
      "!room:server",
    );
  });

  it("adds restricted join rules for a private parented channel", async () => {
    const createRoom = vi.fn().mockResolvedValue({ room_id: "!room:server" });
    const client = fakeClient({ createRoom, sendStateEvent: vi.fn().mockResolvedValue(undefined) });

    await createChannelRoom(client, "!space:server", "secret", false);

    const initialState = createRoom.mock.calls[0][0].initial_state;
    expect(initialState[0].type).toBe("m.room.join_rules");
    expect(initialState[0].content.join_rule).toBe("restricted");
    expect(initialState[1].type).toBe("m.space.parent");
  });
});

describe("createSubspaceRoom", () => {
  it("creates a parented space and links it via m.space.child", async () => {
    const createRoom = vi.fn().mockResolvedValue({ room_id: "!sub:server" });
    const sendStateEvent = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient({ createRoom, sendStateEvent });

    const id = await createSubspaceRoom(client, "!parent:server", "Sub", true);

    expect(id).toBe("!sub:server");
    expect(createRoom.mock.calls[0][0].creation_content).toEqual({ type: "m.space" });
    expect(sendStateEvent).toHaveBeenCalledWith(
      "!parent:server",
      "m.space.child",
      { via: ["server"] },
      "!sub:server",
    );
  });
});

describe("findDirectRoom", () => {
  it("returns the explicit m.direct room", () => {
    const room = fakeRoom({ roomId: "!dm:server", membership: "join" });
    const client = fakeClient({
      direct: { "@friend:server": ["!dm:server"] },
      roomsById: { "!dm:server": room },
    });

    expect(findDirectRoom(client, "@friend:server")).toBe(room);
  });

  it("returns null when no DM exists", () => {
    const client = fakeClient({});
    expect(findDirectRoom(client, "@friend:server")).toBeNull();
  });
});

describe("createOrFindDirectRoom", () => {
  it("joins an invited existing DM and records account data", async () => {
    const room = fakeRoom({ roomId: "!dm:server", membership: "invite" });
    const joinRoom = vi.fn().mockResolvedValue(undefined);
    const setAccountData = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient({
      direct: { "@friend:server": ["!dm:server"] },
      roomsById: { "!dm:server": room },
      joinRoom,
      setAccountData,
    });

    const id = await createOrFindDirectRoom(client, "@friend:server");

    expect(id).toBe("!dm:server");
    expect(joinRoom).toHaveBeenCalledWith("!dm:server");
    expect(setAccountData).toHaveBeenCalledWith("m.direct", { "@friend:server": ["!dm:server"] });
  });

  it("creates a fresh invite-only DM when none exists", async () => {
    const createRoom = vi.fn().mockResolvedValue({ room_id: "!new:server" });
    const setAccountData = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient({ createRoom, setAccountData });

    const id = await createOrFindDirectRoom(client, "@friend:server");

    expect(id).toBe("!new:server");
    expect(createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ is_direct: true, invite: ["@friend:server"], preset: "trusted_private_chat" }),
    );
    expect(setAccountData).toHaveBeenCalledWith("m.direct", { "@friend:server": ["!new:server"] });
  });
});

describe("searchUserDirectory", () => {
  it("drops the current user and maps fields", async () => {
    const searchFn = vi.fn().mockResolvedValue({
      results: [
        { user_id: "@me:server", display_name: "Me", avatar_url: "mxc://me" },
        { user_id: "@friend:server", display_name: "Friend", avatar_url: "mxc://f", extra: "drop" },
      ],
    });
    const client = fakeClient({ searchUserDirectory: searchFn });

    const results = await searchUserDirectory(client, "fri", 8);

    expect(searchFn).toHaveBeenCalledWith({ term: "fri", limit: 8 });
    expect(results).toEqual([
      { user_id: "@friend:server", display_name: "Friend", avatar_url: "mxc://f" },
    ]);
  });
});

function fakeRoom({
  roomId,
  membership = "join",
  inviter = null,
  isSpace = false,
  members = [],
}: {
  roomId: string;
  membership?: string;
  inviter?: string | null;
  isSpace?: boolean;
  members?: Array<{ userId: string }>;
}): Room {
  return {
    roomId,
    getMyMembership: () => membership,
    getDMInviter: () => inviter,
    isSpaceRoom: () => isSpace,
    getJoinedMembers: () => members,
  } as unknown as Room;
}

function fakeClient({
  createRoom = vi.fn(),
  sendStateEvent = vi.fn(),
  uploadContent = vi.fn(),
  joinRoom = vi.fn(),
  setAccountData = vi.fn(),
  searchUserDirectory: searchFn = vi.fn(),
  direct = {},
  roomsById = {},
}: {
  createRoom?: ReturnType<typeof vi.fn>;
  sendStateEvent?: ReturnType<typeof vi.fn>;
  uploadContent?: ReturnType<typeof vi.fn>;
  joinRoom?: ReturnType<typeof vi.fn>;
  setAccountData?: ReturnType<typeof vi.fn>;
  searchUserDirectory?: ReturnType<typeof vi.fn>;
  direct?: Record<string, string[]>;
  roomsById?: Record<string, Room>;
}): MatrixClient {
  return {
    getDomain: () => "server",
    getUserId: () => "@me:server",
    createRoom,
    sendStateEvent,
    uploadContent,
    joinRoom,
    setAccountData,
    searchUserDirectory: searchFn,
    getAccountData: () => ({ getContent: () => direct }),
    getRoom: (id: string) => roomsById[id] ?? null,
    getRooms: () => Object.values(roomsById),
  } as unknown as MatrixClient;
}
