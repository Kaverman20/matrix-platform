import { describe, expect, it } from "vitest";
import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { getMessageReaders } from "./messageReaders";

describe("getMessageReaders", () => {
  it("maps users read up to the event excluding the sender", () => {
    const event = {
      getSender: () => "@alice:hs",
    } as unknown as MatrixEvent;

    const room = {
      findEventById: () => event,
      getUsersReadUpTo: () => ["@alice:hs", "@bob:hs", "@carol:hs"],
      getMember: (userId: string) => ({ name: userId.slice(1, 4).toUpperCase(), getMxcAvatarUrl: () => null }),
    } as unknown as Room;

    const client = {
      getRoom: () => room,
      mxcUrlToHttp: () => null,
    } as unknown as MatrixClient;

    const readers = getMessageReaders(client, "!room:hs", "$msg");
    expect(readers.map((reader) => reader.userId)).toEqual(["@bob:hs", "@carol:hs"]);
    expect(readers[0]?.name).toBe("BOB");
  });
});
