import { RoomMemberEvent, type MatrixClient, type Room, type RoomMember } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import { getTypingNames, subscribeTyping } from "./typing";

describe("getTypingNames", () => {
  it("returns names of other typing members, excluding self", () => {
    const client = fakeClient([
      { userId: "@me:server", name: "Me", typing: true },
      { userId: "@alice:server", name: "Alice", typing: true },
      { userId: "@bob:server", name: "Bob", typing: false },
    ]);

    expect(getTypingNames(client, "!room:server")).toEqual(["Alice"]);
  });

  it("falls back to userId when name is missing", () => {
    const client = fakeClient([{ userId: "@alice:server", name: "", typing: true }]);
    expect(getTypingNames(client, "!room:server")).toEqual(["@alice:server"]);
  });

  it("returns empty when the room is unknown", () => {
    const client = { getRoom: () => null, getUserId: () => "@me:server" } as unknown as MatrixClient;
    expect(getTypingNames(client, "!missing:server")).toEqual([]);
  });
});

describe("subscribeTyping", () => {
  it("calls onChange on typing events and unsubscribes", () => {
    const handlers = new Set<() => void>();
    const client = {
      on: (_event: string, h: () => void) => handlers.add(h),
      off: (_event: string, h: () => void) => handlers.delete(h),
    } as unknown as MatrixClient;
    const onChange = vi.fn();

    const unsub = subscribeTyping(client, onChange);
    handlers.forEach((h) => h());
    expect(onChange).toHaveBeenCalledTimes(1);

    unsub();
    expect(handlers.size).toBe(0);
  });

  it("registers against the Typing event", () => {
    const on = vi.fn();
    const off = vi.fn();
    const client = { on, off } as unknown as MatrixClient;
    const onChange = vi.fn();

    const unsub = subscribeTyping(client, onChange);
    expect(on).toHaveBeenCalledWith(RoomMemberEvent.Typing, onChange);

    unsub();
    expect(off).toHaveBeenCalledWith(RoomMemberEvent.Typing, onChange);
  });
});

function fakeClient(members: Array<{ userId: string; name: string; typing: boolean }>): MatrixClient {
  const room = {
    getMembers: () => members as unknown as RoomMember[],
  } as unknown as Room;
  return {
    getRoom: () => room,
    getUserId: () => "@me:server",
  } as unknown as MatrixClient;
}
