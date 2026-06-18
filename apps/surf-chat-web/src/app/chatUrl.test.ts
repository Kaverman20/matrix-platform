import { describe, expect, it } from "vitest";
import {
  ROOM_URL_PARAM,
  SPACE_URL_PARAM,
  buildSearchWithChatState,
  buildSearchWithRoom,
  readChatUrlFromSearch,
  readRoomIdFromSearch,
  readSpaceIdFromSearch,
} from "./chatUrl";

describe("chatUrl", () => {
  it("reads a Matrix room id from search params", () => {
    const roomId = "!abc:foxhound.run";
    expect(readRoomIdFromSearch(`?${ROOM_URL_PARAM}=${encodeURIComponent(roomId)}`)).toBe(roomId);
  });

  it("reads room and space ids together", () => {
    const roomId = "!room:hs";
    const spaceId = "!space:hs";
    const state = readChatUrlFromSearch(
      `?${ROOM_URL_PARAM}=${encodeURIComponent(roomId)}&${SPACE_URL_PARAM}=${encodeURIComponent(spaceId)}`,
    );
    expect(state.roomId).toBe(roomId);
    expect(state.spaceId).toBe(spaceId);
    expect(readSpaceIdFromSearch(`?${SPACE_URL_PARAM}=${encodeURIComponent(spaceId)}`)).toBe(spaceId);
  });

  it("returns null for missing or invalid room params", () => {
    expect(readRoomIdFromSearch("")).toBeNull();
    expect(readRoomIdFromSearch(`?${ROOM_URL_PARAM}=not-a-room`)).toBeNull();
    expect(readSpaceIdFromSearch(`?${SPACE_URL_PARAM}=not-a-space`)).toBeNull();
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

  it("builds room and space params together", () => {
    const search = buildSearchWithChatState(
      { roomId: "!room:hs", spaceId: "!space:hs" },
      "?foo=1",
    );
    const params = new URLSearchParams(search);
    expect(params.get("foo")).toBe("1");
    expect(params.get(ROOM_URL_PARAM)).toBe("!room:hs");
    expect(params.get(SPACE_URL_PARAM)).toBe("!space:hs");
  });
});
