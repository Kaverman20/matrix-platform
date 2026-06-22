import { describe, expect, it, vi } from "vitest";
import { EventTimeline, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk";
import {
  canPaginateTimelineWindow,
  createRoomTimelineWindow,
  getTimelineWindowMessages,
  loadTimelineWindowAroundEvent,
} from "./timelineWindow";

function fakeEvent(id: string): MatrixEvent {
  return {
    getId: () => id,
    getTxnId: () => undefined,
    getType: () => "m.room.message",
    getSender: () => "@alice:hs",
    getTs: () => 1_000,
    isRedacted: () => false,
    getContent: () => ({ body: "hello", msgtype: "m.text" }),
    getPrevContent: () => ({}),
    replacingEvent: () => null,
    status: null,
  } as unknown as MatrixEvent;
}

describe("createRoomTimelineWindow", () => {
  it("returns null when the room is missing", () => {
    const client = { getRoom: () => null } as unknown as MatrixClient;
    expect(createRoomTimelineWindow(client, "!missing")).toBeNull();
  });
});

describe("loadTimelineWindowAroundEvent", () => {
  it("delegates to TimelineWindow.load", async () => {
    const load = vi.fn(async () => undefined);
    const window = { load } as unknown as import("matrix-js-sdk").TimelineWindow;
    await loadTimelineWindowAroundEvent(window, "$target", 30);
    expect(load).toHaveBeenCalledWith("$target", 30);
  });
});

describe("getTimelineWindowMessages", () => {
  it("maps window events through buildTimelineMessagesFromEvents", () => {
    const events = [fakeEvent("$a"), fakeEvent("$b")];
    const room = {
      getLiveTimeline: () => ({ getEvents: () => events, getState: () => null }),
      getMember: (userId: string) => ({ name: userId, userId }),
      getJoinedMembers: () => [],
      getThread: () => null,
      getThreadUnreadNotificationCount: () => 0,
      hasUserReadEvent: () => false,
      currentState: { getStateEvents: () => undefined },
    } as unknown as Room;

    const client = {
      getUserId: () => "@me:hs",
      getRoom: () => room,
      mxcUrlToHttp: () => null,
    } as unknown as MatrixClient;

    const window = {
      getEvents: () => events,
      canPaginate: () => false,
    } as unknown as import("matrix-js-sdk").TimelineWindow;

    const messages = getTimelineWindowMessages(client, "!r", window);
    expect(messages.map((message) => message.id)).toEqual(["$a", "$b"]);
  });
});

describe("canPaginateTimelineWindow", () => {
  it("delegates to TimelineWindow.canPaginate", () => {
    const canPaginate = vi.fn(() => true);
    const window = { canPaginate } as unknown as import("matrix-js-sdk").TimelineWindow;
    expect(canPaginateTimelineWindow(window, EventTimeline.BACKWARDS)).toBe(true);
    expect(canPaginate).toHaveBeenCalledWith(EventTimeline.BACKWARDS);
  });
});
