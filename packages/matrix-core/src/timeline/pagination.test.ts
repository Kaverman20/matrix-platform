import { describe, expect, it, vi } from "vitest";
import { type MatrixClient, type Room } from "matrix-js-sdk";
import * as mapTimeline from "./mapTimeline";
import {
  canPaginateBackwards,
  isEventInTimeline,
  paginateBackwards,
  paginateToEvent,
} from "./pagination";

vi.spyOn(mapTimeline, "buildTimelineMessages").mockImplementation((client, roomId) => {
  const room = client.getRoom(roomId);
  if (!room) return [];
  return room
    .getLiveTimeline()
    .getEvents()
    .map((event) => ({ id: event.getId() ?? "" }) as import("./messageTypes").MatrixMessage)
    .filter((message) => message.id.length > 0);
});

type RoomState = {
  events: Array<{ id: string }>;
  backwardsToken: string | null;
};

function makeRoom(state: RoomState): Room {
  return {
    getLiveTimeline: () => ({
      getEvents: () =>
        state.events.map((event) => ({
          getType: () => "m.room.message",
          isRedacted: () => false,
          getId: () => event.id,
        })),
      getPaginationToken: () => state.backwardsToken,
    }),
    findEventById: (id: string) =>
      state.events.some((event) => event.id === id) ? { getId: () => id } : null,
  } as unknown as Room;
}

describe("isEventInTimeline", () => {
  it("returns true when the room contains the event", () => {
    const client = {
      getRoom: () => makeRoom({ events: [{ id: "$a" }], backwardsToken: null }),
    } as unknown as MatrixClient;

    expect(isEventInTimeline(client, "!r", "$a")).toBe(true);
  });

  it("returns false when the event is missing", () => {
    const client = {
      getRoom: () => makeRoom({ events: [{ id: "$a" }], backwardsToken: null }),
    } as unknown as MatrixClient;

    expect(isEventInTimeline(client, "!r", "$missing")).toBe(false);
  });
});

describe("paginateToEvent", () => {
  it("returns immediately when the event is already loaded", async () => {
    const paginate = vi.fn();
    const client = {
      getRoom: () => makeRoom({ events: [{ id: "$target" }], backwardsToken: "tok" }),
      paginateEventTimeline: paginate,
    } as unknown as MatrixClient;

    await expect(paginateToEvent(client, "!r", "$target")).resolves.toBe(true);
    expect(paginate).not.toHaveBeenCalled();
  });

  it("paginates backwards until the event appears", async () => {
    const state: RoomState = { events: [{ id: "$new" }], backwardsToken: "tok" };
    const paginate = vi.fn(async () => {
      state.events = [{ id: "$target" }, ...state.events];
      state.backwardsToken = null;
    });

    const client = {
      getRoom: () => makeRoom(state),
      paginateEventTimeline: paginate,
    } as unknown as MatrixClient;

    await expect(paginateToEvent(client, "!r", "$target")).resolves.toBe(true);
    expect(paginate).toHaveBeenCalledTimes(1);
  });

  it("returns false when history is exhausted without finding the event", async () => {
    const client = {
      getRoom: () => makeRoom({ events: [{ id: "$a" }], backwardsToken: null }),
      paginateEventTimeline: vi.fn(),
    } as unknown as MatrixClient;

    await expect(paginateToEvent(client, "!r", "$missing")).resolves.toBe(false);
  });
});

describe("canPaginateBackwards", () => {
  it("reflects the backwards pagination token", () => {
    const client = {
      getRoom: () => makeRoom({ events: [], backwardsToken: "tok" }),
    } as unknown as MatrixClient;
    expect(canPaginateBackwards(client, "!r")).toBe(true);
  });
});

describe("paginateBackwards", () => {
  it("returns false when the room is missing", async () => {
    const client = { getRoom: () => null } as unknown as MatrixClient;
    await expect(paginateBackwards(client, "!r")).resolves.toBe(false);
  });
});
