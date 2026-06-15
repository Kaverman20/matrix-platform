import { describe, expect, it } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import {
  buildReplyFallback,
  removeReaction,
  sendEditMessage,
  sendReaction,
  sendTextMessage,
} from "./sendMessage";

type SentEvent = { type: string; content: Record<string, unknown> };

function fakeClient() {
  const sent: SentEvent[] = [];
  const texts: string[] = [];
  const redactions: string[] = [];
  const client = {
    sendEvent: (_roomId: string, type: string, content: Record<string, unknown>) => {
      sent.push({ type, content });
      return Promise.resolve({ event_id: "$x" });
    },
    sendTextMessage: (_roomId: string, body: string) => {
      texts.push(body);
      return Promise.resolve({ event_id: "$x" });
    },
    redactEvent: (_roomId: string, eventId: string) => {
      redactions.push(eventId);
      return Promise.resolve({ event_id: "$x" });
    },
  } as unknown as MatrixClient;
  return { client, sent, texts, redactions };
}

describe("buildReplyFallback", () => {
  it("builds a quoted plain-text body referencing the sender", () => {
    const { body } = buildReplyFallback(
      { id: "$e", sender: "@bob:server", author: "Bob", text: "hello" },
      "hi there",
    );
    expect(body).toBe("> <@bob:server> hello\n\nhi there");
  });

  it("wraps the quote and reply in an mx-reply blockquote", () => {
    const { formattedBody } = buildReplyFallback(
      { id: "$e", sender: "@bob:server", author: "Bob", text: "hello" },
      "hi",
    );
    expect(formattedBody).toContain("<mx-reply><blockquote>");
    expect(formattedBody).toContain("</blockquote></mx-reply>");
    expect(formattedBody).toContain("hi");
  });

  it("escapes html in the quoted text and reply to prevent injection", () => {
    const { formattedBody } = buildReplyFallback(
      { id: "$e", sender: "@bob:server", author: "Bob", text: "<b>x</b>" },
      "<script>alert(1)</script>",
    );
    expect(formattedBody).not.toContain("<script>");
    expect(formattedBody).toContain("&lt;script&gt;");
    expect(formattedBody).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("falls back to the raw body when the reference has no sender", () => {
    const { body } = buildReplyFallback({ id: "$e" }, "just text");
    expect(body).toBe("just text");
  });
});

describe("sendTextMessage", () => {
  it("sends trimmed text", async () => {
    const { client, texts } = fakeClient();
    await sendTextMessage(client, "!r", "  hello  ");
    expect(texts).toEqual(["hello"]);
  });

  it("ignores empty text", async () => {
    const { client, texts } = fakeClient();
    await sendTextMessage(client, "!r", "   ");
    expect(texts).toHaveLength(0);
  });
});

describe("sendReaction / removeReaction", () => {
  it("sends an annotation reaction for the target event", async () => {
    const { client, sent } = fakeClient();
    await sendReaction(client, "!r", "$target", "👍");
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("m.reaction");
    const rel = sent[0].content["m.relates_to"] as {
      rel_type: string;
      event_id: string;
      key: string;
    };
    expect(rel).toMatchObject({ rel_type: "m.annotation", event_id: "$target", key: "👍" });
  });

  it("redacts the reaction event on remove", async () => {
    const { client, redactions } = fakeClient();
    await removeReaction(client, "!r", "$reaction");
    expect(redactions).toEqual(["$reaction"]);
  });
});

describe("sendEditMessage", () => {
  it("sends a replace relation with new content", async () => {
    const { client, sent } = fakeClient();
    await sendEditMessage(client, "!r", "fixed", "$orig");
    expect(sent).toHaveLength(1);
    expect(sent[0].content.body).toBe("* fixed");
    expect(sent[0].content["m.new_content"]).toMatchObject({ body: "fixed" });
    const rel = sent[0].content["m.relates_to"] as { rel_type: string; event_id: string };
    expect(rel).toMatchObject({ rel_type: "m.replace", event_id: "$orig" });
  });

  it("ignores empty edits", async () => {
    const { client, sent } = fakeClient();
    await sendEditMessage(client, "!r", "  ", "$orig");
    expect(sent).toHaveLength(0);
  });
});
