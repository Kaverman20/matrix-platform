import { describe, expect, it } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { markThreadRead, sendThreadReply } from "./threads";

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
