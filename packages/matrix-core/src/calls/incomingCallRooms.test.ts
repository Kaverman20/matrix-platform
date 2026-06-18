import { describe, expect, it } from "vitest";
import type { MatrixClient, Room } from "matrix-js-sdk";
import { isIncomingCallRoom, listIncomingCallRoomIds } from "./incomingCallRooms";

describe("listIncomingCallRoomIds", () => {
  it("includes favourite and duplicate DM rooms, not only deduped sidebar dms", () => {
    const dmInSidebar = {
      roomId: "!dm-a:hs",
      isSpaceRoom: () => false,
      getMyMembership: () => "join",
      getInvitedAndJoinedMemberCount: () => 2,
      currentState: { getStateEvents: () => null },
      getCanonicalAlias: () => null,
    } as unknown as Room;
    const favouriteDm = {
      roomId: "!dm-b:hs",
      isSpaceRoom: () => false,
      getMyMembership: () => "join",
      getInvitedAndJoinedMemberCount: () => 2,
      currentState: {
        getStateEvents: (_type: string, key?: string) =>
          key === "" ? ({ getContent: () => ({ name: "Bob" }) } as never) : null,
      },
      getCanonicalAlias: () => null,
    } as unknown as Room;
    const channel = {
      roomId: "!ch:hs",
      isSpaceRoom: () => false,
      getMyMembership: () => "join",
      getInvitedAndJoinedMemberCount: () => 10,
      currentState: { getStateEvents: () => [] },
      getCanonicalAlias: () => "#general:hs",
    } as unknown as Room;

    const client = {
      getAccountData: () => ({ getContent: () => ({ "@bob:hs": ["!dm-b:hs"] }) }),
      getRooms: () => [dmInSidebar, favouriteDm, channel],
    } as unknown as MatrixClient;

    expect(listIncomingCallRoomIds(client).sort()).toEqual(["!dm-a:hs", "!dm-b:hs"].sort());
  });
});

describe("isIncomingCallRoom", () => {
  it("accepts m.direct rooms", () => {
    const dmIds = new Set(["!x:hs"]);
    const r = {
      roomId: "!x:hs",
      isSpaceRoom: () => false,
      getMyMembership: () => "join",
      getInvitedAndJoinedMemberCount: () => 2,
      currentState: { getStateEvents: () => null },
      getCanonicalAlias: () => null,
    } as unknown as Room;
    expect(isIncomingCallRoom(r, dmIds)).toBe(true);
  });
});
