import { describe, expect, it } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import type { MatrixMessage } from "@matrix-platform/matrix-core";
import { useFirstUnread } from "./useFirstUnread";

const ME = "@me:server";

type FakeEvent = {
  id: string | null;
  sender?: string;
  type?: string;
  redacted?: boolean;
};

function makeEvent(e: FakeEvent) {
  return {
    getId: () => e.id,
    getSender: () => e.sender ?? "@other:server",
    getType: () => e.type ?? "m.room.message",
    isRedacted: () => e.redacted ?? false,
  };
}

type FakeClient = MatrixClient & { __setReadUpTo: (value: string | null) => void };

function fakeClient({
  events,
  readUpTo,
  userId = ME,
  hasRoom = true,
}: {
  events: FakeEvent[];
  readUpTo: string | null;
  userId?: string | null;
  hasRoom?: boolean;
}): FakeClient {
  const state = { readUpTo };
  const room = {
    getLiveTimeline: () => ({ getEvents: () => events.map(makeEvent) }),
    getEventReadUpTo: () => state.readUpTo,
  };
  const client = {
    getUserId: () => userId,
    getRoom: () => (hasRoom ? room : null),
    __setReadUpTo: (value: string | null) => {
      state.readUpTo = value;
    },
  };
  return client as unknown as FakeClient;
}

// A non-empty messages array only gates resolution; contents are irrelevant.
const RENDERED = [{} as MatrixMessage];

describe("useFirstUnread", () => {
  it("returns null when there is no active room", () => {
    const client = fakeClient({ events: [], readUpTo: null });
    expect(useFirstUnread(client, null, RENDERED)).toBeNull();
  });

  it("returns null when there is no read receipt to anchor to", () => {
    const client = fakeClient({
      events: [{ id: "$a", sender: "@other:server" }],
      readUpTo: null,
    });
    expect(useFirstUnread(client, "!noreceipt:server", RENDERED)).toBeNull();
  });

  it("returns the first message from someone else after the read marker", () => {
    const client = fakeClient({
      events: [
        { id: "$read", sender: ME },
        { id: "$unread1", sender: "@other:server" },
        { id: "$unread2", sender: "@other:server" },
      ],
      readUpTo: "$read",
    });
    expect(useFirstUnread(client, "!firstother:server", RENDERED)).toBe("$unread1");
  });

  it("skips the user's own messages after the marker", () => {
    const client = fakeClient({
      events: [
        { id: "$read", sender: "@other:server" },
        { id: "$mine", sender: ME },
        { id: "$theirs", sender: "@other:server" },
      ],
      readUpTo: "$read",
    });
    expect(useFirstUnread(client, "!skipown:server", RENDERED)).toBe("$theirs");
  });

  it("ignores redacted and non-message events", () => {
    const client = fakeClient({
      events: [
        { id: "$read", sender: "@other:server" },
        { id: "$state", sender: "@other:server", type: "m.room.topic" },
        { id: "$gone", sender: "@other:server", redacted: true },
        { id: "$real", sender: "@other:server" },
      ],
      readUpTo: "$read",
    });
    expect(useFirstUnread(client, "!ignore:server", RENDERED)).toBe("$real");
  });

  it("returns null when everything after the marker is the user's own", () => {
    const client = fakeClient({
      events: [
        { id: "$read", sender: "@other:server" },
        { id: "$mine", sender: ME },
      ],
      readUpTo: "$read",
    });
    expect(useFirstUnread(client, "!allmine:server", RENDERED)).toBeNull();
  });

  it("stays unresolved (no freeze) until the room has rendered messages", () => {
    const client = fakeClient({
      events: [
        { id: "$read", sender: "@other:server" },
        { id: "$unread", sender: "@other:server" },
      ],
      readUpTo: "$read",
    });
    // Empty messages -> not resolved yet -> null, and not cached.
    expect(useFirstUnread(client, "!lazy:server", [])).toBeNull();
    // Once something is rendered it resolves.
    expect(useFirstUnread(client, "!lazy:server", RENDERED)).toBe("$unread");
  });

  it("freezes the divider while the room stays open", () => {
    const roomId = "!frozen:server";
    const client = fakeClient({
      events: [
        { id: "$read", sender: "@other:server" },
        { id: "$unread", sender: "@other:server" },
      ],
      readUpTo: "$read",
    });
    expect(useFirstUnread(client, roomId, RENDERED)).toBe("$unread");

    // Even after the read receipt advances on the same client, the frozen value
    // holds while the room stays open.
    client.__setReadUpTo("$unread");
    expect(useFirstUnread(client, roomId, RENDERED)).toBe("$unread");
  });
});
