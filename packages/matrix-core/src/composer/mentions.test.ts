import { describe, expect, it } from "vitest";
import {
  applyMentionSelection,
  filterMentionCandidates,
  findMentionTrigger,
  resolveMentionsForSend,
} from "./mentions";

const members = [
  { userId: "@bob:server", name: "Bob" },
  { userId: "@alice:server", name: "Alice Example" },
];

describe("mentions", () => {
  it("detects an active mention trigger", () => {
    expect(findMentionTrigger("hello @bo", 9)).toEqual({ start: 6, query: "bo" });
    expect(findMentionTrigger("email bob@test.com", 18)).toBeNull();
  });

  it("filters candidates by display name and localpart", () => {
    expect(filterMentionCandidates("bo", members).map((m) => m.userId)).toEqual(["@bob:server"]);
    expect(filterMentionCandidates("alice", members).map((m) => m.userId)).toEqual(["@alice:server"]);
  });

  it("inserts a display-name mention", () => {
    const next = applyMentionSelection("hey @bo", 4, 7, members[0]!);
    expect(next).toEqual({ text: "hey @Bob ", cursor: 9 });
  });

  it("resolves mentions for outgoing events", () => {
    const resolved = resolveMentionsForSend("hi @Bob", members);
    expect(resolved.userIds).toEqual(["@bob:server"]);
    expect(resolved.formattedBody).toContain("matrix.to");
    expect(resolved.formattedBody).toContain("@Bob");
  });
});
