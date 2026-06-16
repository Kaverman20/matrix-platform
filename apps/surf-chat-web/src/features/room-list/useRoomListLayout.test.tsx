import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRoomListLayout } from "./useRoomListLayout";

const DEFAULT_WIDTH = 304;
const COLLAPSED_WIDTH = 84;
const RAIL_WIDTH = 72;

function pointerEvent(type: string, clientX: number) {
  return new MouseEvent(type, { clientX, bubbles: true });
}

function startResizeEvent() {
  return { preventDefault: vi.fn() } as unknown as ReactPointerEvent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useRoomListLayout", () => {
  it("starts expanded at the default width", () => {
    const { result } = renderHook(() => useRoomListLayout());
    expect(result.current.width).toBe(DEFAULT_WIDTH);
    expect(result.current.collapsed).toBe(false);
    expect(result.current.resizing).toBe(false);
  });

  it("toggles collapse and restores the previous width", () => {
    const { result } = renderHook(() => useRoomListLayout());

    act(() => result.current.toggleCollapse());
    expect(result.current.collapsed).toBe(true);
    expect(result.current.width).toBe(COLLAPSED_WIDTH);

    act(() => result.current.toggleCollapse());
    expect(result.current.collapsed).toBe(false);
    expect(result.current.width).toBe(DEFAULT_WIDTH);
  });

  it("resizes on pointer drag and clamps to the max width", () => {
    const { result } = renderHook(() => useRoomListLayout());

    act(() => result.current.startResize(startResizeEvent()));
    expect(result.current.resizing).toBe(true);

    act(() => window.dispatchEvent(pointerEvent("pointermove", 5000)));
    expect(result.current.width).toBe(440);
    expect(result.current.collapsed).toBe(false);

    act(() => window.dispatchEvent(pointerEvent("pointerup", 5000)));
    expect(result.current.resizing).toBe(false);
  });

  it("snaps to collapsed when dragged below the collapse threshold", () => {
    const { result } = renderHook(() => useRoomListLayout());

    act(() => result.current.startResize(startResizeEvent()));
    // 150 - RAIL_WIDTH = 78, below the 200 collapse threshold.
    act(() => window.dispatchEvent(pointerEvent("pointermove", 150 + RAIL_WIDTH)));
    expect(result.current.collapsed).toBe(true);

    act(() => window.dispatchEvent(pointerEvent("pointerup", 150 + RAIL_WIDTH)));
    expect(result.current.collapsed).toBe(true);
    expect(result.current.width).toBe(COLLAPSED_WIDTH);
  });

  it("removes window listeners after the drag ends", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { result } = renderHook(() => useRoomListLayout());

    act(() => result.current.startResize(startResizeEvent()));
    act(() => window.dispatchEvent(pointerEvent("pointerup", 400)));

    expect(removeSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pointerup", expect.any(Function));
  });
});
