import { describe, expect, it } from "vitest";
import { findSpaceIdForRoom } from "./findSpaceForRoom";
import type { MatrixSpaceSummary } from "./roomTypes";

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

describe("findSpaceIdForRoom", () => {
  it("returns null when the room is not in any space", () => {
    const spaces = [space("!s:hs", ["!other:hs"])];
    expect(findSpaceIdForRoom(spaces, "!dm:hs")).toBeNull();
  });

  it("returns the only matching space", () => {
    const spaces = [space("!team:hs", ["!general:hs"])];
    expect(findSpaceIdForRoom(spaces, "!general:hs")).toBe("!team:hs");
  });

  it("prefers the deepest nested space when multiple match", () => {
    const spaces = [
      space("!root:hs", ["!general:hs", "!sub:hs"], ["!sub:hs"]),
      space("!sub:hs", ["!general:hs"], [], true),
    ];
    expect(findSpaceIdForRoom(spaces, "!general:hs")).toBe("!sub:hs");
  });
});
