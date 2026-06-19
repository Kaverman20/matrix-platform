import { describe, expect, it } from "vitest";
import { filterLoadedMessages } from "@matrix-platform/matrix-core";

describe("timeline search helpers", () => {
  it("matches case-insensitively", () => {
    const hits = filterLoadedMessages(
      [{ id: "$1", text: "Привет мир" }],
      "МИР",
    );
    expect(hits).toHaveLength(1);
  });
});
