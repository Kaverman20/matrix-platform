import { describe, expect, it } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import type { CallMembership } from "matrix-js-sdk/lib/matrixrtc/CallMembership";
import { getDmPeerUserId, userIsInActiveCall } from "./callBusy";

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

describe("userIsInActiveCall", () => {
  it("is false for a solo stale membership (only the user alone in the session)", () => {
    const client = {
      getRooms: () => [{ getMyMembership: () => "join" }],
      matrixRTC: {
        getRoomSession: () => ({
          memberships: [membership("@bob:hs")],
        }),
      },
    } as unknown as MatrixClient;

    expect(userIsInActiveCall(client, "@bob:hs")).toBe(false);
  });

  it("is true when the user shares an RTC session with someone else", () => {
    const client = {
      getRooms: () => [{ getMyMembership: () => "join" }],
      matrixRTC: {
        getRoomSession: () => ({
          memberships: [membership("@bob:hs"), membership("@alice:hs")],
        }),
      },
    } as unknown as MatrixClient;

    expect(userIsInActiveCall(client, "@bob:hs")).toBe(true);
  });

  it("ignores expired memberships", () => {
    const client = {
      getRooms: () => [{ getMyMembership: () => "join" }],
      matrixRTC: {
        getRoomSession: () => ({
          memberships: [membership("@bob:hs", true), membership("@alice:hs", true)],
        }),
      },
    } as unknown as MatrixClient;

    expect(userIsInActiveCall(client, "@bob:hs")).toBe(false);
  });
});
