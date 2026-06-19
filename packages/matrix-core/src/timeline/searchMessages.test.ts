import { describe, expect, it } from "vitest";
import { filterLoadedMessages } from "./searchMessages";

describe("filterLoadedMessages", () => {
  it("filters readable messages by query", () => {
    const messages = [
      { id: "$1", text: "Hello world", kind: "message" as const },
      { id: "$2", text: "Other", kind: "message" as const },
      { id: "$3", text: "System", kind: "system" as const },
    ];

    expect(filterLoadedMessages(messages, "hello").map((item) => item.id)).toEqual(["$1"]);
  });

  it("returns empty for blank query", () => {
    expect(filterLoadedMessages([{ id: "$1", text: "Hi" }], "   ")).toEqual([]);
  });
});
