import { describe, expect, it, vi } from "vitest";
import type { MatrixRoomSummary } from "../rooms/roomTypes";
import {
  buildGlobalSearchItems,
  searchGlobalMessages,
  type GlobalMessageSearchHit,
} from "./globalSearch";

function room(id: string, name: string): MatrixRoomSummary {
  return {
    id,
    name,
    kind: "channel",
    color: "#336699",
    unread: 0,
    mentions: 0,
    favourite: false,
    favouriteOrder: 0,
    preview: "",
    time: "",
    timestamp: 0,
    memberCount: 0,
    topic: "",
  };
}

describe("searchGlobalMessages", () => {
  it("maps server hits to global message results", async () => {
    const event = {
      getId: () => "$e1",
      getRoomId: () => "!r:server",
      getTs: () => 1_700_000_000_000,
      getSender: () => "@alice:server",
      getContent: () => ({ body: "hello world" }),
    };
    const client = {
      searchRoomEvents: vi.fn().mockResolvedValue({
        results: [{ context: { getEvent: () => event } }],
      }),
    };

    const hits = await searchGlobalMessages(client as never, "hello", 10);

    expect(hits).toEqual([
      {
        eventId: "$e1",
        roomId: "!r:server",
        body: "hello world",
        timestamp: 1_700_000_000_000,
        senderId: "@alice:server",
      },
    ]);
  });

  it("returns empty for blank query", async () => {
    const client = { searchRoomEvents: vi.fn() };
    await expect(searchGlobalMessages(client as never, "   ")).resolves.toEqual([]);
    expect(client.searchRoomEvents).not.toHaveBeenCalled();
  });
});

describe("buildGlobalSearchItems", () => {
  const rooms = [room("!general:server", "general"), room("!random:server", "random")];
  const messages: GlobalMessageSearchHit[] = [{
    eventId: "$m1",
    roomId: "!general:server",
    body: "deploy today",
    timestamp: 1,
  }];

  it("orders rooms, users, then messages", () => {
    const items = buildGlobalSearchItems({
      query: "gen",
      rooms,
      users: [{ user_id: "@bob:server", display_name: "Bob" }],
      messages,
      roomNameById: new Map([["!general:server", "general"]]),
    });

    expect(items.map((item) => item.kind)).toEqual(["room", "user", "message"]);
  });

  it("returns empty list for blank query", () => {
    expect(buildGlobalSearchItems({
      query: "  ",
      rooms,
      users: [],
      messages,
      roomNameById: new Map(),
    })).toEqual([]);
  });
});
