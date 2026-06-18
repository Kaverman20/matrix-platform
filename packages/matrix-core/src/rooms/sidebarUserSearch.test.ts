import { describe, expect, it } from "vitest";
import {
  collectExistingDmUserIds,
  isMatrixUserId,
  resolveSidebarUserSearch,
} from "./sidebarUserSearch";

describe("isMatrixUserId", () => {
  it("accepts full Matrix user ids", () => {
    expect(isMatrixUserId("@alice:matrix.foxhound.run")).toBe(true);
  });

  it("rejects partial names", () => {
    expect(isMatrixUserId("alice")).toBe(false);
    expect(isMatrixUserId("@alice")).toBe(false);
  });
});

describe("resolveSidebarUserSearch", () => {
  it("drops users who already have a DM", () => {
    const existing = collectExistingDmUserIds(["@bob:server"]);
    const results = resolveSidebarUserSearch(
      "bob",
      [{ user_id: "@bob:server", display_name: "Bob" }],
      existing,
    );

    expect(results).toEqual([]);
  });

  it("adds a direct Matrix id entry when typed fully", () => {
    const results = resolveSidebarUserSearch(
      "@carol:server",
      [],
      new Set(),
    );

    expect(results).toEqual([{ user_id: "@carol:server" }]);
  });

  it("does not duplicate directory hits", () => {
    const directory = [{ user_id: "@carol:server", display_name: "Carol" }];
    const results = resolveSidebarUserSearch("@carol:server", directory, new Set());

    expect(results).toEqual(directory);
  });
});

describe("collectExistingDmUserIds", () => {
  it("ignores undefined ids", () => {
    expect(collectExistingDmUserIds([undefined, "@a:server"])).toEqual(new Set(["@a:server"]));
  });
});
