import type { MatrixClient } from "matrix-js-sdk";
import { describe, expect, it, vi } from "vitest";
import { reorderFavourites, setRoomFavourite } from "./favourites";

describe("setRoomFavourite", () => {
  it("tags a room as favourite with a default order", async () => {
    const setRoomTag = vi.fn().mockResolvedValue(undefined);
    const deleteRoomTag = vi.fn().mockResolvedValue(undefined);
    const client = { setRoomTag, deleteRoomTag } as unknown as MatrixClient;

    await setRoomFavourite(client, "!r:server", true);

    expect(setRoomTag).toHaveBeenCalledWith("!r:server", "m.favourite", { order: 0.5 });
    expect(deleteRoomTag).not.toHaveBeenCalled();
  });

  it("removes the favourite tag", async () => {
    const setRoomTag = vi.fn().mockResolvedValue(undefined);
    const deleteRoomTag = vi.fn().mockResolvedValue(undefined);
    const client = { setRoomTag, deleteRoomTag } as unknown as MatrixClient;

    await setRoomFavourite(client, "!r:server", false);

    expect(deleteRoomTag).toHaveBeenCalledWith("!r:server", "m.favourite");
    expect(setRoomTag).not.toHaveBeenCalled();
  });
});

describe("reorderFavourites", () => {
  it("spreads order evenly across [0, 1]", async () => {
    const setRoomTag = vi.fn().mockResolvedValue(undefined);
    const client = { setRoomTag } as unknown as MatrixClient;

    await reorderFavourites(client, ["!a", "!b", "!c"]);

    expect(setRoomTag).toHaveBeenCalledWith("!a", "m.favourite", { order: 0 });
    expect(setRoomTag).toHaveBeenCalledWith("!b", "m.favourite", { order: 0.5 });
    expect(setRoomTag).toHaveBeenCalledWith("!c", "m.favourite", { order: 1 });
  });

  it("gives a single favourite order 0", async () => {
    const setRoomTag = vi.fn().mockResolvedValue(undefined);
    const client = { setRoomTag } as unknown as MatrixClient;

    await reorderFavourites(client, ["!only"]);

    expect(setRoomTag).toHaveBeenCalledWith("!only", "m.favourite", { order: 0 });
  });
});
