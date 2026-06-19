import { EventType, RelationType } from "matrix-js-sdk";
import { describe, expect, it } from "vitest";
import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { getMessageEditHistory } from "./editHistory";

function fakeEvent(
  id: string,
  content: Record<string, unknown>,
  opts: { sender?: string; ts?: number } = {},
): MatrixEvent {
  return {
    getId: () => id,
    getType: () => EventType.RoomMessage,
    getSender: () => opts.sender ?? "@alice:hs",
    getTs: () => opts.ts ?? 1_000,
    getContent: () => content,
  } as unknown as MatrixEvent;
}

describe("getMessageEditHistory", () => {
  it("returns original and replace events sorted oldest first", () => {
    const root = fakeEvent("$root", { body: "Hello", formatted_body: "<p>Hello</p>" }, { ts: 1_000 });
    const edit = fakeEvent(
      "$edit",
      {
        body: "* Hello world",
        "m.new_content": { body: "Hello world", formatted_body: "<p>Hello world</p>" },
        "m.relates_to": { rel_type: RelationType.Replace, event_id: "$root" },
      },
      { ts: 2_000 },
    );

    const relations = { getRelations: () => [edit] };
    const room = {
      findEventById: (id: string) => (id === "$root" ? root : null),
      relations: {
        getChildEventsForEvent: (
          eventId: string,
          relType: string,
          eventType: string,
        ) => {
          if (eventId === "$root" && relType === RelationType.Replace && eventType === EventType.RoomMessage) {
            return relations;
          }
          return null;
        },
      },
    } as unknown as Room;

    const client = { getRoom: () => room } as unknown as MatrixClient;
    const history = getMessageEditHistory(client, "!room:hs", "$root");

    expect(history).toHaveLength(2);
    expect(history[0]?.body).toBe("Hello");
    expect(history[1]?.body).toBe("Hello world");
    expect(history[0]?.timestamp).toBeLessThan(history[1]?.timestamp ?? 0);
  });
});
