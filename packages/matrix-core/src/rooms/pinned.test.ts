import { describe, expect, it } from "vitest";
import { getPinnedEventIds, togglePinnedEventId } from "./pinned";

describe("pinned room events", () => {
  it("adds an event id when it is not pinned yet", () => {
    expect(togglePinnedEventId(["$a"], "$b")).toEqual(["$a", "$b"]);
  });

  it("removes an event id when it is already pinned", () => {
    expect(togglePinnedEventId(["$a", "$b"], "$a")).toEqual(["$b"]);
  });

  it("uses optimistic override ids before reading room state", () => {
    expect(getPinnedEventIds(null, null, ["$optimistic"])).toEqual(["$optimistic"]);
  });
});
