import { describe, expect, it, vi } from "vitest";
import { EventType, RelationType, RoomEvent } from "matrix-js-sdk";
import type { MatrixClient, MatrixEvent } from "matrix-js-sdk";
import { declineIncomingCall, subscribePeerDeclined } from "./rtcDecline";

describe("declineIncomingCall", () => {
  it("sends rtc.decline referencing the ring notification", async () => {
    const sendEvent = vi.fn().mockResolvedValue({ event_id: "$decline" });
    const client = { sendEvent } as unknown as MatrixClient;

    await declineIncomingCall(client, "!dm:hs", "$ring");

    expect(sendEvent).toHaveBeenCalledWith("!dm:hs", EventType.RTCDecline, {
      "m.relates_to": {
        event_id: "$ring",
        rel_type: RelationType.Reference,
      },
    });
  });
});

describe("subscribePeerDeclined", () => {
  it("fires when another user declines in the room", () => {
    const handlers = new Map<string, (event: MatrixEvent, room?: { roomId: string }) => void>();
    const client = {
      getUserId: () => "@me:hs",
      on: vi.fn((event: string, handler: (e: MatrixEvent, room?: { roomId: string }) => void) => {
        handlers.set(event, handler);
      }),
      off: vi.fn(),
    } as unknown as MatrixClient;

    const onDeclined = vi.fn();
    subscribePeerDeclined(client, "!dm:hs", onDeclined);

    const decline = {
      getType: () => EventType.RTCDecline,
      getSender: () => "@bob:hs",
      getContent: () => ({
        "m.relates_to": { rel_type: RelationType.Reference, event_id: "$ring" },
      }),
    } as unknown as MatrixEvent;

    handlers.get(RoomEvent.Timeline)!(decline, { roomId: "!dm:hs" });

    expect(onDeclined).toHaveBeenCalledWith("@bob:hs");
  });

  it("ignores own decline events", () => {
    const handlers = new Map<string, (event: MatrixEvent, room?: { roomId: string }) => void>();
    const client = {
      getUserId: () => "@me:hs",
      on: vi.fn((event: string, handler: (e: MatrixEvent, room?: { roomId: string }) => void) => {
        handlers.set(event, handler);
      }),
      off: vi.fn(),
    } as unknown as MatrixClient;

    const onDeclined = vi.fn();
    subscribePeerDeclined(client, "!dm:hs", onDeclined);

    const decline = {
      getType: () => EventType.RTCDecline,
      getSender: () => "@me:hs",
      getContent: () => ({
        "m.relates_to": { rel_type: RelationType.Reference, event_id: "$ring" },
      }),
    } as unknown as MatrixEvent;

    handlers.get(RoomEvent.Timeline)!(decline, { roomId: "!dm:hs" });

    expect(onDeclined).not.toHaveBeenCalled();
  });
});
