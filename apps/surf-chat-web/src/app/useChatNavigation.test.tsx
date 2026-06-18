import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MatrixClient } from "matrix-js-sdk";
import { useChatNavigation } from "./useChatNavigation";

function fakeRoom(name: string, isSpace = false) {
  return { name, isSpaceRoom: () => isSpace };
}

function setup(overrides: Record<string, unknown> = {}) {
  const leave = vi.fn().mockResolvedValue(undefined);
  const client = {
    getRoom: vi.fn((id: string) => fakeRoom(id === "!space:server" ? "Космос" : "Чат")),
    leave,
  } as unknown as MatrixClient;

  const spaceNavigation = {
    effectiveActiveSpaceId: null,
    activeSpace: null,
    spaceParentId: new Map<string, string>(),
  };

  const options = {
    client,
    activeRoomId: "!room:server",
    forwarding: null,
    spaceNavigation: spaceNavigation as never,
    setActiveRoomId: vi.fn(),
    setActiveSpaceId: vi.fn(),
    setRightPanelSection: vi.fn(),
    setPinnedIndex: vi.fn(),
    setHighlightMessageId: vi.fn(),
    setOptimisticPinnedIds: vi.fn(),
    setActiveThreadRootId: vi.fn(),
    setShowThreadsList: vi.fn(),
    setShowAllThreads: vi.fn(),
    setShowRightPanel: vi.fn(),
    setForwarding: vi.fn(),
    clearMessageMenu: vi.fn(),
    clearComposerMode: vi.fn(),
    startForward: vi.fn(),
    focusPinnedMessage: vi.fn(),
    resolveSpaceForRoom: vi.fn(() => null),
    resolveIsDmRoom: vi.fn(() => false),
    setSidebarView: vi.fn(),
    ...overrides,
  };

  const { result } = renderHook(() => useChatNavigation(options as never));
  return { result, options, leave };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useChatNavigation", () => {
  it("selectRoom switches room and resets the room view", () => {
    const { result, options } = setup();
    act(() => result.current.selectRoom("!next:server"));

    expect(options.setActiveRoomId).toHaveBeenCalledWith("!next:server");
    expect(options.resolveSpaceForRoom).toHaveBeenCalledWith("!next:server");
    expect(options.setActiveSpaceId).toHaveBeenCalledWith(null);
    expect(options.setRightPanelSection).toHaveBeenCalledWith("overview");
    expect(options.setActiveThreadRootId).toHaveBeenCalledWith(null);
    expect(options.clearComposerMode).toHaveBeenCalledTimes(1);
  });

  it("selectRoom auto-switches to the room parent space", () => {
    const resolveSpaceForRoom = vi.fn(() => "!space:server");
    const { result, options } = setup({ resolveSpaceForRoom });
    act(() => result.current.selectRoom("!next:server"));

    expect(options.setActiveSpaceId).toHaveBeenCalledWith("!space:server");
    expect(options.setSidebarView).toHaveBeenCalledWith("space");
  });

  it("selectRoom opens the dms sidebar for direct chats", () => {
    const resolveIsDmRoom = vi.fn(() => true);
    const { result, options } = setup({ resolveIsDmRoom });
    act(() => result.current.selectRoom("!dm:server"));

    expect(options.setActiveSpaceId).toHaveBeenCalledWith(null);
    expect(options.setSidebarView).toHaveBeenCalledWith("dms");
  });

  it("closeActiveRoom clears the open room and side state", () => {
    const { result, options } = setup();
    act(() => result.current.closeActiveRoom());

    expect(options.setActiveRoomId).toHaveBeenCalledWith(null);
    expect(options.setShowRightPanel).toHaveBeenCalledWith(false);
    expect(options.clearMessageMenu).toHaveBeenCalledTimes(1);
    expect(options.clearComposerMode).toHaveBeenCalledTimes(1);
  });

  it("leaveRoom confirms, leaves, and clears the active room", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result, options, leave } = setup({ activeRoomId: "!room:server" });

    await act(async () => {
      await result.current.leaveRoom("!room:server");
    });

    expect(leave).toHaveBeenCalledWith("!room:server");
    expect(options.setActiveRoomId).toHaveBeenCalledWith(null);
  });

  it("leaveRoom does nothing when the confirm is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { result, leave } = setup();

    await act(async () => {
      await result.current.leaveRoom("!room:server");
    });

    expect(leave).not.toHaveBeenCalled();
  });

  it("leaveRoom keeps the active room when leaving a different one", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { result, options, leave } = setup({ activeRoomId: "!room:server" });

    await act(async () => {
      await result.current.leaveRoom("!other:server");
    });

    expect(leave).toHaveBeenCalledWith("!other:server");
    expect(options.setActiveRoomId).not.toHaveBeenCalled();
  });

  it("selectForwardRoom is a no-op when nothing is being forwarded", () => {
    const { result, options } = setup({ forwarding: null });
    act(() => result.current.selectForwardRoom("!dest:server"));

    expect(options.setActiveRoomId).not.toHaveBeenCalled();
    expect(options.startForward).not.toHaveBeenCalled();
  });
});
