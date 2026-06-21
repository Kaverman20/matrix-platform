import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
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
}): MatrixClient {
  const room = {
    getLiveTimeline: () => ({ getEvents: () => events.map(makeEvent) }),
    getEventReadUpTo: () => readUpTo,
  };
  return {
    getUserId: () => userId,
    getRoom: () => (hasRoom ? room : null),
  } as unknown as MatrixClient;
}

// A non-empty messages array only gates resolution; contents are irrelevant.
const RENDERED = [{} as MatrixMessage];

type Props = { client: MatrixClient | null; roomId: string | null; messages: MatrixMessage[] };

function render(initialProps: Props) {
  return renderHook(
    ({ client, roomId, messages }: Props) => useFirstUnread(client, roomId, messages),
    { initialProps },
  );
}

describe("useFirstUnread", () => {
  it("returns null when there is no active room", () => {
    const client = fakeClient({ events: [], readUpTo: null });
    const { result } = render({ client, roomId: null, messages: RENDERED });
    expect(result.current).toBeNull();
  });

  it("returns null when there is no read receipt to anchor to", () => {
    const client = fakeClient({
      events: [{ id: "$a", sender: "@other:server" }],
      readUpTo: null,
    });
    const { result } = render({ client, roomId: "!noreceipt:server", messages: RENDERED });
    expect(result.current).toBeNull();
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
    const { result } = render({ client, roomId: "!firstother:server", messages: RENDERED });
    expect(result.current).toBe("$unread1");
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
    const { result } = render({ client, roomId: "!skipown:server", messages: RENDERED });
    expect(result.current).toBe("$theirs");
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
    const { result } = render({ client, roomId: "!ignore:server", messages: RENDERED });
    expect(result.current).toBe("$real");
  });

  it("returns null when everything after the marker is the user's own", () => {
    const client = fakeClient({
      events: [
        { id: "$read", sender: "@other:server" },
        { id: "$mine", sender: ME },
      ],
      readUpTo: "$read",
    });
    const { result } = render({ client, roomId: "!allmine:server", messages: RENDERED });
    expect(result.current).toBeNull();
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
    const { result, rerender } = render({ client, roomId: "!lazy:server", messages: [] });
    expect(result.current).toBeNull();
    // Once something is rendered it resolves.
    rerender({ client, roomId: "!lazy:server", messages: RENDERED });
    expect(result.current).toBe("$unread");
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
    const { result, rerender } = render({ client, roomId, messages: RENDERED });
    expect(result.current).toBe("$unread");

    // Even if the read receipt advances, the frozen value holds while open.
    const advanced = fakeClient({
      events: [
        { id: "$read", sender: "@other:server" },
        { id: "$unread", sender: "@other:server" },
      ],
      readUpTo: "$unread",
    });
    rerender({ client: advanced, roomId, messages: RENDERED });
    expect(result.current).toBe("$unread");
  });
});
