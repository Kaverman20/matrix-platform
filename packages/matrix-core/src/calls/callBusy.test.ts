import { describe, expect, it } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import type { CallMembership } from "matrix-js-sdk/lib/matrixrtc/CallMembership";
import { getDmPeerUserId, userHasActiveRtcMembership } from "./callBusy";

function membership(userId: string, expired = false): CallMembership {
  return { userId, isExpired: () => expired } as unknown as CallMembership;
}

describe("getDmPeerUserId", () => {
  it("returns the other member in a DM", () => {
    const client = {
      getUserId: () => "@me:hs",
      getRoom: () => ({
        getJoinedMembers: () => [{ userId: "@me:hs" }, { userId: "@bob:hs" }],
      }),
    } as unknown as MatrixClient;

    expect(getDmPeerUserId(client, "!dm:hs")).toBe("@bob:hs");
  });
});

describe("userHasActiveRtcMembership", () => {
  it("is true when the user is in any active RTC session", () => {
    const client = {
      getRooms: () => [
        {
          roomId: "!a:hs",
          getMyMembership: () => "join",
        },
      ],
      matrixRTC: {
        getRoomSession: () => ({
          memberships: [membership("@bob:hs")],
        }),
      },
    } as unknown as MatrixClient;

    expect(userHasActiveRtcMembership(client, "@bob:hs")).toBe(true);
    expect(userHasActiveRtcMembership(client, "@alice:hs")).toBe(false);
  });

  it("ignores expired memberships", () => {
    const client = {
      getRooms: () => [{ getMyMembership: () => "join" }],
      matrixRTC: {
        getRoomSession: () => ({
          memberships: [membership("@bob:hs", true)],
        }),
      },
    } as unknown as MatrixClient;

    expect(userHasActiveRtcMembership(client, "@bob:hs")).toBe(false);
  });
});
