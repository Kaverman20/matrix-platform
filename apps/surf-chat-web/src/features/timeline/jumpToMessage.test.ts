import { describe, expect, it } from "vitest";
import { isMessageNodeVisible } from "./jumpToMessage";

describe("isMessageNodeVisible", () => {
  it("returns false for zero-size nodes", () => {
    const node = {
      getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }),
    } as HTMLElement;

    expect(isMessageNodeVisible(node)).toBe(false);
  });

  it("returns true when the node sits in the viewport", () => {
    const node = {
      getBoundingClientRect: () => ({
        top: 200,
        bottom: 260,
        left: 0,
        right: 100,
        width: 100,
        height: 60,
      }),
    } as HTMLElement;

    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
    expect(isMessageNodeVisible(node)).toBe(true);
  });
});
