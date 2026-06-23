import { describe, expect, it } from "vitest";
import { clampZoom } from "./lightboxZoom";

describe("clampZoom", () => {
  it("держит зум в диапазоне [1, 4]", () => {
    expect(clampZoom(1 + 0.5)).toBe(1.5);
    expect(clampZoom(0.5)).toBe(1); // ниже минимума → 1
    expect(clampZoom(10)).toBe(4); // выше максимума → 4
    expect(clampZoom(4)).toBe(4);
    expect(clampZoom(1)).toBe(1);
  });
});
