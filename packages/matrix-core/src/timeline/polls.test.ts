import { RelationType } from "matrix-js-sdk";
import { describe, expect, it } from "vitest";
import type { MatrixEvent, Room } from "matrix-js-sdk";
import { parsePollFromEvent, sendPollResponse } from "./polls";

function fakePollRoom(id: string, responses: MatrixEvent[] = []): Room {
  const relations = { getRelations: () => responses };
  return {
    relations: {
      getChildEventsForEvent: (
        eventId: string,
        relType: string,
        eventType: string,
      ) => {
        if (eventId === id && relType === RelationType.Reference && eventType === "m.poll.response") {
          return relations;
        }
        return null;
      },
    },
  } as unknown as Room;
}

function fakePollEvent(id: string, content: Record<string, unknown>): MatrixEvent {
  return {
    getId: () => id,
    getContent: () => content,
  } as unknown as MatrixEvent;
}

describe("parsePollFromEvent", () => {
  it("parses MSC3381 poll start events", () => {
    const event = fakePollEvent("$poll", {
      msgtype: "m.poll.start",
      body: "Question?",
      "org.matrix.msc3381.poll.start": {
        question: { body: "Favorite color?" },
        answers: [
          { id: "a1", body: "Red" },
          { id: "a2", body: "Blue" },
        ],
        max_selections: 1,
        kind: "org.matrix.msc3381.poll.disclosed",
      },
    });

    const poll = parsePollFromEvent(event, fakePollRoom("$poll"), "@me:hs");
    expect(poll?.question).toBe("Favorite color?");
    expect(poll?.answers).toEqual([
      { id: "a1", text: "Red" },
      { id: "a2", text: "Blue" },
    ]);
    expect(poll?.maxSelections).toBe(1);
    expect(poll?.kind).toBe("disclosed");
  });

  it("counts votes and tracks my selections", () => {
    const responses = [
      {
        getContent: () => ({
          msgtype: "m.poll.response",
          "org.matrix.msc3381.poll.response": { answers: ["a1"] },
        }),
        getSender: () => "@alice:hs",
      },
      {
        getContent: () => ({
          msgtype: "m.poll.response",
          "org.matrix.msc3381.poll.response": { answers: ["a2"] },
        }),
        getSender: () => "@me:hs",
      },
    ] as unknown as MatrixEvent[];

    const event = fakePollEvent("$poll", {
      msgtype: "m.poll.start",
      body: "Q",
      "org.matrix.msc3381.poll.start": {
        question: { body: "Q" },
        answers: [
          { id: "a1", body: "One" },
          { id: "a2", body: "Two" },
        ],
      },
    });

    const poll = parsePollFromEvent(event, fakePollRoom("$poll", responses), "@me:hs");
    expect(poll?.voteCounts).toEqual({ a1: 1, a2: 1 });
    expect(poll?.totalVotes).toBe(2);
    expect(poll?.mySelections).toEqual(["a2"]);
  });
});

describe("sendPollResponse", () => {
  it("sends m.poll.response with reference relation", async () => {
    const sent: Array<{ type: string; content: Record<string, unknown> }> = [];
    const client = {
      sendEvent: (_roomId: string, type: string, content: Record<string, unknown>) => {
        sent.push({ type, content });
        return Promise.resolve({ event_id: "$vote" });
      },
    };

    await sendPollResponse(client as never, "!room:hs", "$poll", ["a1"]);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.content.msgtype).toBe("m.poll.response");
    expect(sent[0]?.content["org.matrix.msc3381.poll.response"]).toEqual({ answers: ["a1"] });
    expect(sent[0]?.content["m.relates_to"]).toEqual({
      rel_type: RelationType.Reference,
      event_id: "$poll",
    });
  });
});
