import { describe, expect, it } from "vitest";
import {
  navigationStatesEqual,
  parseMultiTabNavMessage,
  shouldApplyRemoteNavigation,
} from "./multiTabNavigation";

describe("parseMultiTabNavMessage", () => {
  it("accepts valid navigation payloads", () => {
    expect(parseMultiTabNavMessage({
      type: "nav",
      tabId: "tab-a",
      roomId: "!room:server",
      spaceId: null,
      sidebarView: "home",
    })).toEqual({
      type: "nav",
      tabId: "tab-a",
      roomId: "!room:server",
      spaceId: null,
      sidebarView: "home",
    });
  });

  it("rejects malformed payloads", () => {
    expect(parseMultiTabNavMessage(null)).toBeNull();
    expect(parseMultiTabNavMessage({ type: "logout" })).toBeNull();
    expect(parseMultiTabNavMessage({
      type: "nav",
      tabId: "",
      roomId: null,
      spaceId: null,
      sidebarView: "home",
    })).toBeNull();
  });
});

describe("shouldApplyRemoteNavigation", () => {
  const current = {
    roomId: "!old:server",
    spaceId: null,
    sidebarView: "home" as const,
  };

  it("ignores messages from the same tab", () => {
    expect(shouldApplyRemoteNavigation({
      type: "nav",
      tabId: "tab-a",
      roomId: "!new:server",
      spaceId: null,
      sidebarView: "home",
    }, "tab-a", current)).toBe(false);
  });

  it("ignores duplicate state", () => {
    expect(shouldApplyRemoteNavigation({
      type: "nav",
      tabId: "tab-b",
      roomId: current.roomId,
      spaceId: current.spaceId,
      sidebarView: current.sidebarView,
    }, "tab-a", current)).toBe(false);
  });

  it("applies changed remote state", () => {
    expect(shouldApplyRemoteNavigation({
      type: "nav",
      tabId: "tab-b",
      roomId: "!new:server",
      spaceId: null,
      sidebarView: "dms",
    }, "tab-a", current)).toBe(true);
  });
});

describe("navigationStatesEqual", () => {
  it("compares room, space, and sidebar view", () => {
    expect(navigationStatesEqual(
      { roomId: "!a:server", spaceId: null, sidebarView: "home" },
      { roomId: "!a:server", spaceId: null, sidebarView: "home" },
    )).toBe(true);
    expect(navigationStatesEqual(
      { roomId: "!a:server", spaceId: null, sidebarView: "home" },
      { roomId: "!b:server", spaceId: null, sidebarView: "home" },
    )).toBe(false);
  });
});
