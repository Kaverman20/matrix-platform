import { describe, expect, it } from "vitest";
import {
  ROOM_URL_PARAM,
  buildSearchWithRoom,
  readRoomIdFromSearch,
} from "./chatUrl";

describe("chatUrl", () => {
  it("reads a Matrix room id from search params", () => {
    const roomId = "!abc:foxhound.run";
    expect(readRoomIdFromSearch(`?${ROOM_URL_PARAM}=${encodeURIComponent(roomId)}`)).toBe(roomId);
  });

  it("returns null for missing or invalid room params", () => {
    expect(readRoomIdFromSearch("")).toBeNull();
    expect(readRoomIdFromSearch(`?${ROOM_URL_PARAM}=not-a-room`)).toBeNull();
  });

  it("builds search strings without dropping unrelated params", () => {
    const withRoom = new URLSearchParams(buildSearchWithRoom("!x:hs", "?foo=1"));
    expect(withRoom.get("foo")).toBe("1");
    expect(withRoom.get(ROOM_URL_PARAM)).toBe("!x:hs");

    const cleared = new URLSearchParams(
      buildSearchWithRoom(null, `?${ROOM_URL_PARAM}=${encodeURIComponent("!x:hs")}&foo=1`),
    );
    expect(cleared.get(ROOM_URL_PARAM)).toBeNull();
    expect(cleared.get("foo")).toBe("1");
  });
});
