import type { MatrixClient, Room } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import { canManageRoom, getRoomSettingsSnapshot, saveRoomSettings } from "./settings";

describe("room settings", () => {
  it("reads room settings snapshot", () => {
    const client = fakeClient({
      name: "General",
      state: {
        "m.room.topic": { topic: "Team chat" },
        "m.room.avatar": { url: "mxc://server/avatar" },
        "m.room.power_levels": {
          users: { "@me:server": 50 },
          events: { "m.room.name": 50 },
        },
      },
    });

    expect(getRoomSettingsSnapshot(client, "!room:server")).toMatchObject({
      roomId: "!room:server",
      isSpace: false,
      name: "General",
      topic: "Team chat",
      currentAvatarUrl: "https://media/avatar",
      canManage: true,
    });
  });

  it("checks manage permission from power levels", () => {
    const client = fakeClient({
      state: {
        "m.room.power_levels": {
          users: { "@me:server": 49 },
          events: { "m.room.name": 50 },
        },
      },
    });

    expect(canManageRoom(client, "!room:server")).toBe(false);
  });

  it("saves changed name, topic and avatar", async () => {
    const setRoomName = vi.fn().mockResolvedValue(undefined);
    const setRoomTopic = vi.fn().mockResolvedValue(undefined);
    const sendStateEvent = vi.fn().mockResolvedValue(undefined);
    const uploadContent = vi.fn().mockResolvedValue({ content_uri: "mxc://server/new-avatar" });
    const client = fakeClient({
      name: "Old",
      state: { "m.room.topic": { topic: "Old topic" } },
      setRoomName,
      setRoomTopic,
      sendStateEvent,
      uploadContent,
    });
    const avatarFile = new File(["avatar"], "avatar.png", { type: "image/png" });

    await saveRoomSettings(client, "!room:server", {
      name: "New",
      topic: "New topic",
      avatarFile,
    });

    expect(setRoomName).toHaveBeenCalledWith("!room:server", "New");
    expect(setRoomTopic).toHaveBeenCalledWith("!room:server", "New topic");
    expect(uploadContent).toHaveBeenCalledWith(avatarFile, { type: "image/png" });
    expect(sendStateEvent).toHaveBeenCalledWith(
      "!room:server",
      "m.room.avatar",
      { url: "mxc://server/new-avatar" },
      "",
    );
  });
});

function fakeClient({
  name = "Room",
  state = {},
  setRoomName = vi.fn(),
  setRoomTopic = vi.fn(),
  sendStateEvent = vi.fn(),
  uploadContent = vi.fn(),
}: {
  name?: string;
  state?: Record<string, unknown>;
  setRoomName?: ReturnType<typeof vi.fn>;
  setRoomTopic?: ReturnType<typeof vi.fn>;
  sendStateEvent?: ReturnType<typeof vi.fn>;
  uploadContent?: ReturnType<typeof vi.fn>;
}): MatrixClient {
  const room = {
    name,
    isSpaceRoom: () => false,
    currentState: {
      getStateEvents: (type: string) => (
        state[type]
          ? { getContent: () => state[type] }
          : undefined
      ),
    },
    getLiveTimeline: () => ({
      getState: () => undefined,
    }),
  } as unknown as Room;

  return {
    getRoom: () => room,
    getUserId: () => "@me:server",
    mxcUrlToHttp: () => "https://media/avatar",
    setRoomName,
    setRoomTopic,
    sendStateEvent,
    uploadContent,
  } as unknown as MatrixClient;
}
