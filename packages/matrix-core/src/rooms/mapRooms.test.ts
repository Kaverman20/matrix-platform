import type { MatrixClient, Room } from "matrix-js-sdk";
import { describe, expect, it } from "vitest";
import { buildRoomGroups } from "./mapRooms";

describe("buildRoomGroups space children", () => {
  it("includes m.space.child entries even when via is missing", () => {
    const childEvent = {
      getStateKey: () => "!channel:server",
      getContent: () => ({}),
    };
    const space = {
      roomId: "!space:server",
      name: "Team",
      getMyMembership: () => "join",
      isSpaceRoom: () => true,
      currentState: {
        getStateEvents: (type: string) => (type === "m.space.child" ? [childEvent] : undefined),
      },
    };

    const client = {
      getRooms: () => [space],
      getAccountData: () => undefined,
      getUserId: () => "@me:server",
      mxcUrlToHttp: () => undefined,
    } as unknown as MatrixClient;

    const groups = buildRoomGroups(client);

    expect(groups.spaces).toHaveLength(1);
    expect(groups.spaces[0]?.childIds).toEqual(["!channel:server"]);
  });
});

describe("buildRoomGroups timestamps", () => {
  it("maps room list time labels without invalid dates", () => {
    const room = fakeChannelRoom({
      roomId: "!room:server",
      lastTs: 0,
    });

    const client = fakeClient([room]);
    const groups = buildRoomGroups(client);

    expect(groups.channels[0]?.time).toBe("");
    expect(groups.channels[0]?.timestamp).toBe(0);
  });
});

function fakeChannelRoom(opts: { roomId: string; lastTs: number }): Room {
  return {
    roomId: opts.roomId,
    name: "general",
    tags: undefined,
    getMyMembership: () => "join",
    isSpaceRoom: () => false,
    getUnreadNotificationCount: () => 0,
    getInvitedAndJoinedMemberCount: () => 3,
    getCanonicalAlias: () => "#general:server",
    getLastActiveTimestamp: () => opts.lastTs,
    getJoinedMembers: () => [],
    getLiveTimeline: () => ({ getEvents: () => [] }),
    currentState: {
      getStateEvents: () => undefined,
    },
  } as unknown as Room;
}

function fakeClient(rooms: Room[]): MatrixClient {
  return {
    getRooms: () => rooms,
    getAccountData: () => undefined,
    getUserId: () => "@me:server",
    mxcUrlToHttp: () => undefined,
  } as unknown as MatrixClient;
}
