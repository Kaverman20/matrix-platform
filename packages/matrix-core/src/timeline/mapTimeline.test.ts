import { describe, expect, it } from "vitest";
import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import {
  buildTimelineMessages,
  isThreadReplyEvent,
} from "./mapTimeline";

function fakeEvent(
  id: string,
  content: Record<string, unknown>,
  opts: { redacted?: boolean; type?: string; sender?: string; ts?: number } = {},
): MatrixEvent {
  return {
    getId: () => id,
    getTxnId: () => undefined,
    getType: () => opts.type ?? "m.room.message",
    getSender: () => opts.sender ?? "@alice:hs",
    getTs: () => opts.ts ?? 1_000,
    isRedacted: () => Boolean(opts.redacted),
    getContent: () => content,
    getPrevContent: () => ({}),
    replacingEvent: () => null,
    status: null,
  } as unknown as MatrixEvent;
}

function fakeRoom(events: MatrixEvent[]): Room {
  const timeline = {
    getEvents: () => events,
    getState: () => null,
  };
  return {
    getLiveTimeline: () => timeline,
    getMember: (userId: string) => ({ name: userId, userId }),
    getJoinedMembers: () => [],
    getThread: () => null,
    getThreadUnreadNotificationCount: () => 0,
    findEventById: (id: string) => events.find((event) => event.getId() === id),
    hasUserReadEvent: () => false,
  } as unknown as Room;
}

function fakeClient(room: Room): MatrixClient {
  return {
    getUserId: () => "@me:hs",
    getRoom: () => room,
    mxcUrlToHttp: () => null,
  } as unknown as MatrixClient;
}

describe("isThreadReplyEvent", () => {
  it("detects thread replies", () => {
    const event = fakeEvent("$r", {
      body: "reply",
      msgtype: "m.text",
      "m.relates_to": { rel_type: "m.thread", event_id: "$root" },
    });
    expect(isThreadReplyEvent(event)).toBe(true);
  });

  it("ignores regular messages", () => {
    const event = fakeEvent("$m", { body: "hello", msgtype: "m.text" });
    expect(isThreadReplyEvent(event)).toBe(false);
  });
});

describe("buildTimelineMessages", () => {
  it("hides thread replies from the main timeline", () => {
    const root = fakeEvent("$root", { body: "root", msgtype: "m.text" }, { ts: 1_000 });
    const reply = fakeEvent(
      "$reply",
      {
        body: "in thread",
        msgtype: "m.text",
        "m.relates_to": { rel_type: "m.thread", event_id: "$root" },
      },
      { ts: 2_000 },
    );
    const room = fakeRoom([root, reply]);
    const messages = buildTimelineMessages(fakeClient(room), "!r");

    expect(messages.map((message) => message.id)).toEqual(["$root"]);
  });

  it("renders tombstones for redacted messages", () => {
    const deleted = fakeEvent("$d", { body: "secret" }, { redacted: true, ts: 1_000 });
    const room = fakeRoom([deleted]);
    const messages = buildTimelineMessages(fakeClient(room), "!r");

    expect(messages).toHaveLength(1);
    expect(messages[0]?.deleted).toBe(true);
    expect(messages[0]?.text).toBe("Сообщение удалено");
  });

  it("includes formatted_body on messages", () => {
    const event = fakeEvent("$m", {
      body: "visit https://example.com",
      formatted_body: 'visit <a href="https://example.com">example</a>',
      msgtype: "m.text",
    });
    const room = fakeRoom([event]);
    const messages = buildTimelineMessages(fakeClient(room), "!r");

    expect(messages[0]?.formattedBody).toContain("example.com");
  });
});
