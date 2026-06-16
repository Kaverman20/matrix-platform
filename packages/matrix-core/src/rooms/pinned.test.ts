import type { MatrixClient, Room } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import { canPinMessages, getPinnedEventIds, setPinnedEventIds, togglePinnedEventId } from "./pinned";

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

  it("reads pinned ids from room state", () => {
    const client = fakeClient({
      "m.room.pinned_events": { pinned: ["$a", 123, "$b"] },
    });

    expect(getPinnedEventIds(client, "!room:server")).toEqual(["$a", "$b"]);
  });

  it("checks power levels before allowing pinned changes", () => {
    const client = fakeClient({
      "m.room.power_levels": {
        users: { "@me:server": 50 },
        events: { "m.room.pinned_events": 50 },
      },
    });

    expect(canPinMessages(client, "!room:server")).toBe(true);
  });

  it("sends pinned state events", async () => {
    const sendStateEvent = vi.fn().mockResolvedValue(undefined);
    const client = fakeClient({}, sendStateEvent);

    await setPinnedEventIds(client, "!room:server", ["$a"]);

    expect(sendStateEvent).toHaveBeenCalledWith(
      "!room:server",
      "m.room.pinned_events",
      { pinned: ["$a"] },
      "",
    );
  });
});

function fakeClient(
  state: Record<string, unknown>,
  sendStateEvent = vi.fn(),
): MatrixClient {
  const room = {
    currentState: {
      getStateEvents: (type: string) => (
        state[type]
          ? { getContent: () => state[type] }
          : undefined
      ),
    },
    getLiveTimeline: () => ({
      getState: () => undefined,
    }),
  } as unknown as Room;

  return {
    getRoom: () => room,
    getUserId: () => "@me:server",
    sendStateEvent,
  } as unknown as MatrixClient;
}
