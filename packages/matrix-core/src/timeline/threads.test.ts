import { describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { EventTimeline } from "matrix-js-sdk";
import { canPaginateThreadBackwards, markThreadRead, paginateThreadBackwards, sendThreadReply } from "./threads";

type SentEvent = { roomId: string; type: string; content: Record<string, unknown> };

function fakeClient(opts: { lastReplyId?: string } = {}) {
  const sent: SentEvent[] = [];
  const receipts: unknown[] = [];
  const thread = {
    lastReply: () => (opts.lastReplyId ? { getId: () => opts.lastReplyId } : null),
    rootEvent: { getId: () => "$root" },
  };
  const client = {
    getRoom: () => ({ getThread: () => thread }),
    sendEvent: (roomId: string, type: string, content: Record<string, unknown>) => {
      sent.push({ roomId, type, content });
      return Promise.resolve({ event_id: "$new" });
    },
    sendReadReceipt: (event: unknown) => {
      receipts.push(event);
      return Promise.resolve({});
    },
  } as unknown as MatrixClient;
  return { client, sent, receipts };
}

function relatesTo(content: Record<string, unknown>) {
  return content["m.relates_to"] as {
    rel_type: string;
    event_id: string;
    is_falling_back: boolean;
    "m.in_reply_to": { event_id: string };
  };
}

describe("sendThreadReply", () => {
  it("does nothing for blank text", async () => {
    const { client, sent } = fakeClient();
    await sendThreadReply(client, "!r", "$root", "   ");
    expect(sent).toHaveLength(0);
  });

  it("posts a thread message related to the root", async () => {
    const { client, sent } = fakeClient({ lastReplyId: "$last" });
    await sendThreadReply(client, "!r", "$root", "hi");
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("m.room.message");
    expect(sent[0].content.body).toBe("hi");
    const rel = relatesTo(sent[0].content);
    expect(rel.rel_type).toBe("m.thread");
    expect(rel.event_id).toBe("$root");
  });

  it("uses a falling-back in_reply_to to the latest thread event by default", async () => {
    const { client, sent } = fakeClient({ lastReplyId: "$last" });
    await sendThreadReply(client, "!r", "$root", "hi");
    const rel = relatesTo(sent[0].content);
    expect(rel.is_falling_back).toBe(true);
    expect(rel["m.in_reply_to"].event_id).toBe("$last");
  });

  it("makes a real reply to a specific message when given a target", async () => {
    const { client, sent } = fakeClient({ lastReplyId: "$last" });
    await sendThreadReply(client, "!r", "$root", "hi", "$target");
    const rel = relatesTo(sent[0].content);
    expect(rel.is_falling_back).toBe(false);
    expect(rel["m.in_reply_to"].event_id).toBe("$target");
  });

  it("falls back to the root when the thread has no replies yet", async () => {
    const { client, sent } = fakeClient();
    await sendThreadReply(client, "!r", "$root", "first");
    const rel = relatesTo(sent[0].content);
    expect(rel["m.in_reply_to"].event_id).toBe("$root");
  });
});

describe("markThreadRead", () => {
  it("sends a read receipt for the latest thread event", async () => {
    const { client, receipts } = fakeClient({ lastReplyId: "$last" });
    await markThreadRead(client, "!r", "$root");
    expect(receipts).toHaveLength(1);
  });
});

describe("thread backwards pagination", () => {
  function paginationClient(opts: {
    token?: string | null;
    messageCount?: number;
    growOnPaginate?: number;
  } = {}) {
    let messageCount = opts.messageCount ?? 2;
    const paginate = vi.fn(async () => {
      messageCount += opts.growOnPaginate ?? 1;
    });
    const thread = {
      liveTimeline: {
        getPaginationToken: (direction: string) => {
          if (direction !== EventTimeline.BACKWARDS) return null;
          if (opts.token === null) return null;
          return opts.token ?? "tok";
        },
      },
      get events() {
        return Array.from({ length: messageCount }, () => ({
          getType: () => "m.room.message",
          isRedacted: () => false,
        }));
      },
      lastReply: () => null,
      rootEvent: { getId: () => "$root" },
    };
    const client = {
      getRoom: () => ({ getThread: () => thread }),
      paginateEventTimeline: paginate,
    } as unknown as MatrixClient;
    return { client, paginate };
  }

  it("reports when older thread pages exist", () => {
    const { client } = paginationClient({ token: "tok" });
    expect(canPaginateThreadBackwards(client, "!r", "$root")).toBe(true);
  });

  it("returns false when the thread has no backwards token", () => {
    const { client } = paginationClient({ token: null });
    expect(canPaginateThreadBackwards(client, "!r", "$root")).toBe(false);
  });

  it("loads an older page and returns true when new messages appear", async () => {
    const { client, paginate } = paginationClient({ messageCount: 2 });
    await expect(paginateThreadBackwards(client, "!r", "$root")).resolves.toBe(true);
    expect(paginate).toHaveBeenCalledOnce();
  });

  it("returns false when pagination does not add messages", async () => {
    const { client } = paginationClient({ messageCount: 2, growOnPaginate: 0 });
    await expect(paginateThreadBackwards(client, "!r", "$root")).resolves.toBe(false);
  });
});
