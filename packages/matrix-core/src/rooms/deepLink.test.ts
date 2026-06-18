import { describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { parseLocationDeepLink, resolveDeepLink } from "./deepLink";

describe("parseLocationDeepLink", () => {
  it("parses a room id hash", () => {
    expect(parseLocationDeepLink({ hash: "#/!abc:hs" })).toEqual({
      type: "room",
      roomId: "!abc:hs",
    });
  });

  it("parses a room id with an event id", () => {
    expect(parseLocationDeepLink({ hash: "#/!abc:hs/$event123" })).toEqual({
      type: "room",
      roomId: "!abc:hs",
      eventId: "$event123",
    });
  });

  it("parses a user id hash", () => {
    expect(parseLocationDeepLink({ hash: "#/@alice:hs" })).toEqual({
      type: "user",
      userId: "@alice:hs",
    });
  });

  it("parses a room alias hash", () => {
    expect(parseLocationDeepLink({ hash: "/#general:hs" })).toEqual({
      type: "alias",
      alias: "#general:hs",
    });
  });

  it("returns null for an empty hash", () => {
    expect(parseLocationDeepLink({ hash: "" })).toBeNull();
  });
});

describe("resolveDeepLink", () => {
  it("opens an existing joined room without calling join", async () => {
    const client = {
      getRoom: () => ({ roomId: "!abc:hs", getMyMembership: () => "join" }),
      joinRoom: vi.fn(),
    } as unknown as MatrixClient;

    await expect(resolveDeepLink(client, { type: "room", roomId: "!abc:hs" })).resolves.toBe("!abc:hs");
    expect(client.joinRoom).not.toHaveBeenCalled();
  });

  it("joins a room when not yet a member", async () => {
    const client = {
      getRoom: () => null,
      joinRoom: vi.fn().mockResolvedValue({ roomId: "!abc:hs" }),
    } as unknown as MatrixClient;

    await expect(resolveDeepLink(client, { type: "room", roomId: "!abc:hs" })).resolves.toBe("!abc:hs");
    expect(client.joinRoom).toHaveBeenCalledWith("!abc:hs");
  });
});
