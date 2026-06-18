import { describe, expect, it, vi, afterEach } from "vitest";
import { EventType, RoomEvent } from "matrix-js-sdk";
import type { MatrixClient, MatrixEvent } from "matrix-js-sdk";
import { subscribeIncomingRings } from "./incomingRing";

function ringEvent(sender: string): MatrixEvent {
  return {
    getType: () => EventType.RTCNotification,
    getSender: () => sender,
    getContent: () => ({
      notification_type: "ring",
      sender_ts: Date.now(),
      lifetime: 60_000,
      "m.mentions": { user_ids: ["@me:hs"] },
    }),
  } as unknown as MatrixEvent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("subscribeIncomingRings", () => {
  it("invokes callback for a ring from another user in a DM", () => {
    const handlers = new Map<string, (event: MatrixEvent, room?: { roomId: string }) => void>();
    const client = {
      getUserId: () => "@me:hs",
      getRoom: () => ({
        getMember: () => ({ rawDisplayName: "Alice", name: "Alice" }),
      }),
      on: vi.fn((event: string, handler: (e: MatrixEvent, room?: { roomId: string }) => void) => {
        handlers.set(event, handler);
      }),
      off: vi.fn(),
    } as unknown as MatrixClient;

    const onRing = vi.fn();
    subscribeIncomingRings(client, ["!dm:hs"], onRing);

    const onTimeline = handlers.get(RoomEvent.Timeline);
    onTimeline!(ringEvent("@alice:hs"), { roomId: "!dm:hs" });

    expect(onRing).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "!dm:hs",
        callerId: "@alice:hs",
        callerName: "Alice",
      }),
    );
  });
});
