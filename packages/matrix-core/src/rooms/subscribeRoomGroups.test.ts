import { ClientEvent, RoomEvent, type MatrixClient, type Room } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import { subscribeRoomGroups } from "./subscribeRoomGroups";

describe("subscribeRoomGroups", () => {
  it("attaches unread listeners to rooms that join after subscribe", () => {
    vi.stubGlobal("window", globalThis);
    vi.useFakeTimers();

    const handlers = new Map<string, Set<(room: Room) => void>>();
    const existingRoom = fakeRoom("existing");
    const newRoom = fakeRoom("new");
    const onChange = vi.fn();

    const client = {
      on: (event: string, handler: (room: Room) => void) => {
        const set = handlers.get(event) ?? new Set();
        set.add(handler);
        handlers.set(event, set);
      },
      off: (event: string, handler: (room: Room) => void) => {
        handlers.get(event)?.delete(handler);
      },
      getRooms: () => [existingRoom],
    } as unknown as MatrixClient;

    const unsubscribe = subscribeRoomGroups(client, onChange);

    expect(existingRoom.on).toHaveBeenCalledWith(RoomEvent.UnreadNotifications, expect.any(Function));

    const onRoom = [...(handlers.get(ClientEvent.Room) ?? [])][0];
    onRoom(newRoom);

    expect(newRoom.on).toHaveBeenCalledWith(RoomEvent.UnreadNotifications, expect.any(Function));

    unsubscribe();
    expect(existingRoom.off).toHaveBeenCalledWith(RoomEvent.UnreadNotifications, expect.any(Function));
    expect(newRoom.off).toHaveBeenCalledWith(RoomEvent.UnreadNotifications, expect.any(Function));

    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

function fakeRoom(id: string): Room {
  return {
    roomId: id,
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as Room;
}
