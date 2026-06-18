import { describe, expect, it, vi, afterEach } from "vitest";
import { EventType, RelationType, RoomEvent } from "matrix-js-sdk";
import { MatrixRTCSessionEvent } from "matrix-js-sdk/lib/matrixrtc/MatrixRTCSession";
import type { MatrixClient, MatrixEvent } from "matrix-js-sdk";
import type { CallMembership } from "matrix-js-sdk/lib/matrixrtc/CallMembership";
import { RING_MAX_AGE_MS, subscribeIncomingCallSignals } from "./incomingRing";

type TimelineHandler = (
  event: MatrixEvent,
  room?: { roomId: string },
  toStartOfTimeline?: boolean,
  removed?: boolean,
  data?: { liveEvent?: boolean },
) => void;

function ringEvent(sender: string, senderTs = Date.now()): MatrixEvent {
  return {
    getId: () => "$ring",
    getType: () => EventType.RTCNotification,
    getSender: () => sender,
    getContent: () => ({
      notification_type: "ring",
      sender_ts: senderTs,
      lifetime: 60_000,
      "m.mentions": { user_ids: ["@me:hs"] },
    }),
  } as unknown as MatrixEvent;
}

function membership(userId: string, createdTs = Date.now(), expired = false): CallMembership {
  return {
    userId,
    isExpired: () => expired,
    createdTs: () => createdTs,
  } as unknown as CallMembership;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("subscribeIncomingCallSignals", () => {
  it("invokes onRing for a live ring when the caller has fresh RTC membership", () => {
    const handlers = new Map<string, TimelineHandler>();
    const client = {
      getUserId: () => "@me:hs",
      getRoom: () => ({
        getMember: () => ({ rawDisplayName: "Alice", name: "Alice" }),
      }),
      matrixRTC: {
        getRoomSession: () => ({
          memberships: [membership("@alice:hs")],
          on: vi.fn(),
          off: vi.fn(),
        }),
      },
      on: vi.fn((event: string, handler: TimelineHandler) => {
        handlers.set(event, handler);
      }),
      off: vi.fn(),
    } as unknown as MatrixClient;

    const onRing = vi.fn();
    subscribeIncomingCallSignals(client, ["!dm:hs"], { onRing, onRingEnded: vi.fn() });

    handlers.get(RoomEvent.Timeline)!(ringEvent("@alice:hs"), { roomId: "!dm:hs" }, false, false, {
      liveEvent: true,
    });

    expect(onRing).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "!dm:hs",
        callerId: "@alice:hs",
        callerName: "Alice",
        notificationEventId: "$ring",
      }),
    );
  });

  it("ignores a live ring when the caller only has stale RTC membership", () => {
    const handlers = new Map<string, TimelineHandler>();
    const client = {
      getUserId: () => "@me:hs",
      getRoom: () => ({
        getMember: () => ({ rawDisplayName: "Alice", name: "Alice" }),
      }),
      matrixRTC: {
        getRoomSession: () => ({
          memberships: [membership("@alice:hs", Date.now() - RING_MAX_AGE_MS - 5_000)],
          on: vi.fn(),
          off: vi.fn(),
        }),
      },
      on: vi.fn((event: string, handler: TimelineHandler) => {
        handlers.set(event, handler);
      }),
      off: vi.fn(),
    } as unknown as MatrixClient;

    const onRing = vi.fn();
    subscribeIncomingCallSignals(client, ["!dm:hs"], { onRing, onRingEnded: vi.fn() });

    handlers.get(RoomEvent.Timeline)!(ringEvent("@alice:hs"), { roomId: "!dm:hs" }, false, false, {
      liveEvent: true,
    });

    expect(onRing).not.toHaveBeenCalled();
  });

  it("ignores stale rings replayed from timeline sync on page load", () => {
    const handlers = new Map<string, TimelineHandler>();
    const client = {
      getUserId: () => "@me:hs",
      getRoom: () => ({
        getMember: () => ({ rawDisplayName: "Alice", name: "Alice" }),
      }),
      matrixRTC: {
        getRoomSession: () => ({
          memberships: [membership("@alice:hs", Date.now() - RING_MAX_AGE_MS - 5_000)],
          on: vi.fn(),
          off: vi.fn(),
        }),
      },
      on: vi.fn((event: string, handler: TimelineHandler) => {
        handlers.set(event, handler);
      }),
      off: vi.fn(),
    } as unknown as MatrixClient;

    const onRing = vi.fn();
    subscribeIncomingCallSignals(client, ["!dm:hs"], { onRing, onRingEnded: vi.fn() });

    handlers.get(RoomEvent.Timeline)!(
      ringEvent("@alice:hs", Date.now() - RING_MAX_AGE_MS - 1_000),
      { roomId: "!dm:hs" },
    );

    expect(onRing).not.toHaveBeenCalled();
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

  it("does not invoke onRing when the caller joins the RTC session (membership-only)", () => {
    const rtcHandlers = new Map<string, (oldM: CallMembership[], newM: CallMembership[]) => void>();
    const session = {
      memberships: [] as CallMembership[],
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
    session.memberships = [membership("@alice:hs")];
    onChanged!([], [membership("@alice:hs")]);

    expect(onRing).not.toHaveBeenCalled();
  });

  it("invokes onRingEnded on live rtc.decline from the caller", () => {
    const handlers = new Map<string, TimelineHandler>();
    const client = {
      getUserId: () => "@me:hs",
      getRoom: () => null,
      matrixRTC: { getRoomSession: () => ({ memberships: [], on: vi.fn(), off: vi.fn() }) },
      on: vi.fn((event: string, handler: TimelineHandler) => {
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

    handlers.get(RoomEvent.Timeline)!(decline, { roomId: "!dm:hs" }, false, false, {
      liveEvent: true,
    });

    expect(onRingEnded).toHaveBeenCalledWith({
      roomId: "!dm:hs",
      notificationEventId: "$ring",
    });
  });
});
