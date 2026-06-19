import { describe, expect, it } from "vitest";
import { transformComposerSelection, wrapComposerSelection } from "./formatting";

describe("wrapComposerSelection", () => {
  it("wraps strikethrough markers", () => {
    const next = wrapComposerSelection("hello world", 6, 11, "strikethrough");
    expect(next.text).toBe("hello ~~world~~");
  });

  it("prefixes quote lines", () => {
    const next = wrapComposerSelection("one\ntwo", 0, 7, "quote");
    expect(next.text).toBe("> one\n> two");
  });
});

describe("transformComposerSelection", () => {
  it("clears markdown wrappers", () => {
    const next = transformComposerSelection("**bold**", 0, 8, "clear");
    expect(next.text).toBe("bold");
  });

  it("uppercases selection", () => {
    const next = transformComposerSelection("hello", 0, 5, "upper");
    expect(next.text).toBe("HELLO");
  });
});
