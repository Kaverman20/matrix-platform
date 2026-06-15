import { describe, expect, it } from "vitest";
import { colorForId } from "./colors";

const PALETTE = ["#5b6b7a", "#6f7d63", "#a9745b", "#7d6f8c", "#b4795f", "#5e807d"];

describe("colorForId", () => {
  it("is deterministic for the same id", () => {
    expect(colorForId("!room:server")).toBe(colorForId("!room:server"));
  });

  it("always returns a colour from the palette", () => {
    for (const id of ["a", "!x:y", "@user:server", "", "длинный-айди-кириллица"]) {
      expect(PALETTE).toContain(colorForId(id));
    }
  });
});
