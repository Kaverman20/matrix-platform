import { describe, expect, it } from "vitest";
import {
  computeDmMentions,
  computeDmUnreads,
  computeTopLevelSpaceMentions,
  computeTopLevelSpaceUnreads,
  formatUnreadCount,
} from "./spaceUnreads";
import type { MatrixRoomGroups, MatrixRoomSummary, MatrixSpaceSummary } from "./roomTypes";

function space(
  id: string,
  childIds: string[],
  childSpaceIds: string[] = [],
  nested = false,
): MatrixSpaceSummary {
  return {
    id,
    name: id,
    label: id,
    color: "#000",
    childIds,
    childSpaceIds,
    nested,
  };
}

function room(id: string, unread: number, mentions = 0): MatrixRoomSummary {
  return {
    id,
    name: id,
    preview: "",
    time: "",
    timestamp: 0,
    color: "#000",
    unread,
    mentions,
    kind: "channel",
    favourite: false,
    favouriteOrder: 0,
    memberCount: 1,
    topic: "",
  };
}

describe("computeTopLevelSpaceUnreads", () => {
  it("returns empty counts when nothing is unread", () => {
    const groups: Pick<MatrixRoomGroups, "favourites" | "channels" | "dms"> = {
      favourites: [],
      channels: [room("!general:hs", 0)],
      dms: [],
    };
    const spaces = [space("!team:hs", ["!general:hs"])];
    expect(computeTopLevelSpaceUnreads(spaces, groups)).toEqual({});
  });

  it("aggregates unread onto the top-level space", () => {
    const groups = {
      favourites: [],
      channels: [room("!general:hs", 3), room("!random:hs", 2)],
      dms: [],
    };
    const spaces = [space("!team:hs", ["!general:hs", "!random:hs"])];
    expect(computeTopLevelSpaceUnreads(spaces, groups)).toEqual({ "!team:hs": 5 });
  });

  it("rolls nested space unreads up to the top-level rail ancestor", () => {
    const groups = {
      favourites: [],
      channels: [room("!general:hs", 4)],
      dms: [],
    };
    const spaces = [
      space("!root:hs", ["!sub:hs"], ["!sub:hs"]),
      space("!sub:hs", ["!general:hs"], [], true),
    ];
    expect(computeTopLevelSpaceUnreads(spaces, groups)).toEqual({ "!root:hs": 4 });
  });

  it("ignores rooms that are not in any space", () => {
    const groups = {
      favourites: [],
      channels: [room("!orphan:hs", 7)],
      dms: [{ ...room("!dm:hs", 2, 1), kind: "dm" as const }],
    };
    expect(computeTopLevelSpaceUnreads([], groups)).toEqual({});
    expect(computeDmUnreads(groups)).toBe(2);
    expect(computeDmMentions(groups)).toBe(1);
  });

  it("aggregates mention counts separately from unreads", () => {
    const groups = {
      favourites: [],
      channels: [room("!general:hs", 0, 2), room("!random:hs", 5, 0)],
      dms: [],
    };
    const spaces = [space("!team:hs", ["!general:hs", "!random:hs"])];
    expect(computeTopLevelSpaceUnreads(spaces, groups)).toEqual({ "!team:hs": 5 });
    expect(computeTopLevelSpaceMentions(spaces, groups)).toEqual({ "!team:hs": 2 });
  });
});

describe("formatUnreadCount", () => {
  it("caps large counts", () => {
    expect(formatUnreadCount(120)).toBe("99+");
    expect(formatUnreadCount(3)).toBe("3");
    expect(formatUnreadCount(0)).toBe("");
  });
});
