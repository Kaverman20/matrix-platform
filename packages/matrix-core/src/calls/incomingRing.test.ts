import { describe, expect, it, vi, afterEach } from "vitest";
import { EventType, RelationType, RoomEvent } from "matrix-js-sdk";
import { MatrixRTCSessionEvent } from "matrix-js-sdk/lib/matrixrtc/MatrixRTCSession";
import type { MatrixClient, MatrixEvent } from "matrix-js-sdk";
import type { CallMembership } from "matrix-js-sdk/lib/matrixrtc/CallMembership";
import { subscribeIncomingCallSignals } from "./incomingRing";

function ringEvent(sender: string): MatrixEvent {
  return {
    getId: () => "$ring",
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

function membership(userId: string, expired = false): CallMembership {
  return {
    userId,
    isExpired: () => expired,
  } as unknown as CallMembership;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("subscribeIncomingCallSignals", () => {
  it("invokes onRing for a ring from another user in a DM", () => {
    const handlers = new Map<string, (event: MatrixEvent, room?: { roomId: string }) => void>();
    const client = {
      getUserId: () => "@me:hs",
      getRoom: () => ({
        getMember: () => ({ rawDisplayName: "Alice", name: "Alice" }),
      }),
      matrixRTC: { getRoomSession: () => ({ memberships: [], on: vi.fn(), off: vi.fn() }) },
      on: vi.fn((event: string, handler: (e: MatrixEvent, room?: { roomId: string }) => void) => {
        handlers.set(event, handler);
      }),
      off: vi.fn(),
    } as unknown as MatrixClient;

    const onRing = vi.fn();
    const onRingEnded = vi.fn();
    subscribeIncomingCallSignals(client, ["!dm:hs"], { onRing, onRingEnded });

    handlers.get(RoomEvent.Timeline)!(ringEvent("@alice:hs"), { roomId: "!dm:hs" });

    expect(onRing).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "!dm:hs",
        callerId: "@alice:hs",
        callerName: "Alice",
        notificationEventId: "$ring",
      }),
    );
    expect(onRingEnded).not.toHaveBeenCalled();
  });

  it("invokes onRingEnded when the caller leaves the RTC session", () => {
    const rtcHandlers = new Map<string, (oldM: CallMembership[], newM: CallMembership[]) => void>();
    const session = {
      memberships: [membership("@alice:hs")],
      on: vi.fn((event: string, handler: (o: CallMembership[], n: CallMembership[]) => void) => {
        rtcHandlers.set(event, handler);
      }),
      off: vi.fn(),
    };
    const client = {
      getUserId: () => "@me:hs",
      getRoom: () => ({ getMember: () => null }),
      matrixRTC: { getRoomSession: () => session },
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as MatrixClient;

    const onRingEnded = vi.fn();
    subscribeIncomingCallSignals(client, ["!dm:hs"], { onRing: vi.fn(), onRingEnded });

    const onChanged = rtcHandlers.get(MatrixRTCSessionEvent.MembershipsChanged);
    onChanged!([membership("@alice:hs")], []);

    expect(onRingEnded).toHaveBeenCalledWith({
      roomId: "!dm:hs",
      callerId: "@alice:hs",
    });
  });

  it("invokes onRingEnded on rtc.decline from the caller", () => {
    const handlers = new Map<string, (event: MatrixEvent, room?: { roomId: string }) => void>();
    const client = {
      getUserId: () => "@me:hs",
      getRoom: () => null,
      matrixRTC: { getRoomSession: () => ({ memberships: [], on: vi.fn(), off: vi.fn() }) },
      on: vi.fn((event: string, handler: (e: MatrixEvent, room?: { roomId: string }) => void) => {
        handlers.set(event, handler);
      }),
      off: vi.fn(),
    } as unknown as MatrixClient;

    const onRingEnded = vi.fn();
    subscribeIncomingCallSignals(client, ["!dm:hs"], { onRing: vi.fn(), onRingEnded });

    const decline = {
      getType: () => EventType.RTCDecline,
      getSender: () => "@alice:hs",
      getContent: () => ({
        "m.relates_to": { rel_type: RelationType.Reference, event_id: "$ring" },
      }),
    } as unknown as MatrixEvent;

    handlers.get(RoomEvent.Timeline)!(decline, { roomId: "!dm:hs" });

    expect(onRingEnded).toHaveBeenCalledWith({
      roomId: "!dm:hs",
      notificationEventId: "$ring",
    });
  });

  it("invokes onRing with a pending id when the caller joins the RTC session", () => {
    const rtcHandlers = new Map<string, (oldM: CallMembership[], newM: CallMembership[]) => void>();
    const session = {
      memberships: [membership("@alice:hs")],
      on: vi.fn((event: string, handler: (o: CallMembership[], n: CallMembership[]) => void) => {
        rtcHandlers.set(event, handler);
      }),
      off: vi.fn(),
    };
    const client = {
      getUserId: () => "@me:hs",
      getRoom: () => ({ getMember: () => ({ rawDisplayName: "Alice", name: "Alice" }) }),
      matrixRTC: { getRoomSession: () => session },
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as MatrixClient;

    const onRing = vi.fn();
    subscribeIncomingCallSignals(client, ["!dm:hs"], { onRing, onRingEnded: vi.fn() });

    const onChanged = rtcHandlers.get(MatrixRTCSessionEvent.MembershipsChanged);
    onChanged!([], [membership("@alice:hs")]);

    expect(onRing).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "!dm:hs",
        callerId: "@alice:hs",
        notificationEventId: "pending:!dm:hs:@alice:hs",
      }),
    );
  });
});
