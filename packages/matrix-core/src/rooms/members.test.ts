import type { MatrixClient, Room } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import { canKickMember, getRoomMemberPermissions, inviteUser, kickUser } from "./members";

describe("room members", () => {
  it("reads invite and kick permissions", () => {
    const client = fakeClient({
      myId: "@me:server",
      state: {
        "m.room.power_levels": {
          users: { "@me:server": 100 },
          invite: 50,
          kick: 50,
        },
      },
    });

    expect(getRoomMemberPermissions(client, "!room:server")).toMatchObject({
      canInvite: true,
      canKick: true,
      myPowerLevel: 100,
    });
  });

  it("blocks kicking equal or higher power users", () => {
    const client = fakeClient({
      myId: "@me:server",
      state: {
        "m.room.power_levels": {
          users: { "@me:server": 50, "@admin:server": 100 },
          kick: 50,
        },
      },
    });

    expect(canKickMember(client, "!room:server", "@admin:server")).toBe(false);
    expect(canKickMember(client, "!room:server", "@bob:server")).toBe(true);
  });

  it("invites and kicks users", async () => {
    const invite = vi.fn().mockResolvedValue(undefined);
    const kick = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient({ invite, kick });

    await inviteUser(client, "!room:server", "@bob:server");
    await kickUser(client, "!room:server", "@bob:server", "bye");

    expect(invite).toHaveBeenCalledWith("!room:server", "@bob:server");
    expect(kick).toHaveBeenCalledWith("!room:server", "@bob:server", "bye");
  });
});

function fakeClient(options: {
  myId?: string;
  state?: Record<string, unknown>;
  invite?: ReturnType<typeof vi.fn>;
  kick?: ReturnType<typeof vi.fn>;
} = {}): MatrixClient {
  const room = {
    currentState: {
      getStateEvents: (type: string) => ({
        getContent: () => options.state?.[type] ?? {},
      }),
    },
    getLiveTimeline: () => ({
      getState: () => ({
        getStateEvents: (type: string) => ({
          getContent: () => options.state?.[type] ?? {},
        }),
      }),
    }),
  } as unknown as Room;

  return {
    getUserId: () => options.myId ?? "@me:server",
    getRoom: () => room,
    invite: options.invite ?? vi.fn(),
    kick: options.kick ?? vi.fn(),
  } as unknown as MatrixClient;
}
