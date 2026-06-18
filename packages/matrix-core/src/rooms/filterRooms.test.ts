import { describe, expect, it } from "vitest";
import type { MatrixRoomSummary } from "./roomTypes";
import { filterRoomSummaries, roomSummaryMatchesQuery } from "./filterRooms";

function room(overrides: Partial<MatrixRoomSummary> = {}): MatrixRoomSummary {
  return {
    id: "!room:server",
    name: "general",
    preview: "hello world",
    time: "12:00",
    timestamp: 1,
    color: "#000",
    unread: 0,
    mentions: 0,
    kind: "channel",
    favourite: false,
    favouriteOrder: 0,
    memberCount: 2,
    topic: "team chat",
    ...overrides,
  };
}

describe("filterRoomSummaries", () => {
  it("returns all rooms for an empty query", () => {
    const rooms = [room(), room({ id: "!other:server", name: "random" })];
    expect(filterRoomSummaries(rooms, "")).toEqual(rooms);
    expect(filterRoomSummaries(rooms, "   ")).toEqual(rooms);
  });

  it("matches name, preview, topic, room id, and direct user id", () => {
    const rooms = [
      room(),
      room({ id: "!dm:server", name: "Alice", kind: "dm", preview: "see you", topic: "", directUserId: "@alice:server" }),
    ];

    expect(filterRoomSummaries(rooms, "general")).toHaveLength(1);
    expect(filterRoomSummaries(rooms, "hello")).toHaveLength(1);
    expect(filterRoomSummaries(rooms, "team chat")).toHaveLength(1);
    expect(filterRoomSummaries(rooms, "!room:server")).toHaveLength(1);
    expect(filterRoomSummaries(rooms, "@alice:server")).toHaveLength(1);
    expect(filterRoomSummaries(rooms, "alice:server")).toHaveLength(1);
  });

  it("is case-insensitive", () => {
    expect(filterRoomSummaries([room()], "GENERAL")).toHaveLength(1);
  });
});

describe("roomSummaryMatchesQuery", () => {
  it("matches every room when query is empty", () => {
    expect(roomSummaryMatchesQuery(room(), "")).toBe(true);
  });
});
